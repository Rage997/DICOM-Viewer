/**
 * Volume Builder - Assembles 3D volumes from ordered DICOM slices
 */

import type { DicomFile, DicomSeries, Volume } from '@/types';
import { SliceOrderer } from './SliceOrderer';

/**
 * Build 3D volume from DICOM series
 */
export class VolumeBuilder {
  /**
   * Build volume from series
   */
  static buildVolume(series: DicomSeries): Volume {
    console.log('[VolumeBuilder] Building volume from series:', {
      seriesUID: series.seriesInstanceUID,
      instanceCount: series.instances.length,
      modality: series.modality,
    });

    if (series.instances.length === 0) {
      throw new Error('Cannot build volume from empty series');
    }

    // Order slices spatially
    const orderedSlices = SliceOrderer.orderByPosition(series.instances);
    console.log('[VolumeBuilder] Ordered slices:', orderedSlices.length);

    // Validate consistency
    this.validateConsistency(orderedSlices);

    // Get dimensions from first slice
    const firstSlice = orderedSlices[0]!;
    const { rows, columns } = firstSlice.metadata;

    const dimensions = {
      x: columns,
      y: rows,
      z: orderedSlices.length,
    };

    // Calculate spacing
    const pixelSpacing = firstSlice.metadata.pixelSpacing || [1, 1];
    const sliceSpacing = SliceOrderer.calculateSliceSpacing(orderedSlices) || 1.0;

    const spacing = {
      // DICOM PixelSpacing (0028,0030) is [rowSpacing, columnSpacing]:
      // index 0 = gap between adjacent rows (vertical → Y),
      // index 1 = gap between adjacent columns (horizontal → X).
      x: pixelSpacing[1], // column spacing (horizontal)
      y: pixelSpacing[0], // row spacing (vertical)
      z: sliceSpacing,
    };

    // Get origin from first slice
    const origin = firstSlice.metadata.imagePositionPatient || [0, 0, 0];

    // Get orientation
    const orientation = this.calculateOrientation(firstSlice);
    if (!this.isAxisAligned(orientation)) {
      console.warn(
        '[VolumeBuilder] Series orientation is oblique or gantry-tilted. MPR ' +
          'reslices and measurements assume axis-aligned planes, so cross-plane ' +
          'measurements will be approximate.'
      );
    }

    // Allocate volume data
    const { data, dataRange } = this.assembleVolumeData(orderedSlices);

    // Get rescale parameters
    const rescaleSlope = firstSlice.metadata.rescaleSlope || 1;
    const rescaleIntercept = firstSlice.metadata.rescaleIntercept || 0;

    // Get window/level (use first value if array)
    const windowCenter = firstSlice.metadata.windowCenter;
    const windowLevel = Array.isArray(windowCenter) ? windowCenter[0] : windowCenter;

    const winWidth = firstSlice.metadata.windowWidth;
    const windowWidth = Array.isArray(winWidth) ? winWidth[0] : winWidth;

    const volume: Volume = {
      seriesInstanceUID: series.seriesInstanceUID,
      modality: series.modality,
      dimensions,
      spacing,
      origin,
      orientation,
      data,
      dataRange,
      rescaleSlope,
      rescaleIntercept,
      windowLevel,
      windowWidth,
    };

    console.log('[VolumeBuilder] Volume built:', {
      dimensions,
      spacing,
      dataRange,
      dataType: data.constructor.name,
      dataLength: data.length,
      rescaleSlope,
      rescaleIntercept,
      windowLevel,
      windowWidth,
    });

    return volume;
  }

  /**
   * Validate that all slices have consistent dimensions
   */
  private static validateConsistency(files: DicomFile[]): void {
    if (files.length === 0) return;

    const first = files[0]!;
    const expectedRows = first.metadata.rows;
    const expectedColumns = first.metadata.columns;

    for (const file of files) {
      if (file.metadata.rows !== expectedRows || file.metadata.columns !== expectedColumns) {
        throw new Error(
          `Inconsistent dimensions: ${file.fileName} has ${file.metadata.rows}x${file.metadata.columns}, expected ${expectedRows}x${expectedColumns}`
        );
      }
    }
  }

  /**
   * Calculate orientation matrix
   */
  private static calculateOrientation(file: DicomFile) {
    const imageOrientation = file.metadata.imageOrientationPatient;

    if (!imageOrientation) {
      // Default orientation (axial)
      return {
        row: [1, 0, 0] as [number, number, number],
        column: [0, 1, 0] as [number, number, number],
        slice: [0, 0, 1] as [number, number, number],
      };
    }

    // Row and column directions from DICOM
    const row: [number, number, number] = [
      imageOrientation[0],
      imageOrientation[1],
      imageOrientation[2],
    ];

    const column: [number, number, number] = [
      imageOrientation[3],
      imageOrientation[4],
      imageOrientation[5],
    ];

    // Calculate slice direction (cross product)
    const slice: [number, number, number] = [
      row[1] * column[2] - row[2] * column[1],
      row[2] * column[0] - row[0] * column[2],
      row[0] * column[1] - row[1] * column[0],
    ];

    return { row, column, slice };
  }

  /**
   * True when the orientation's row/column/slice cosines are (near) signed unit
   * basis vectors — i.e. the acquisition grid aligns with the patient axes.
   * When false, the volume is oblique/gantry-tilted and axis-aligned reslicing
   * (used by MPR + measurements) is only approximate.
   */
  static isAxisAligned(
    orientation: { row: [number, number, number]; column: [number, number, number]; slice: [number, number, number] },
    tolerance = 1e-3
  ): boolean {
    const isUnitAxis = (v: [number, number, number]): boolean => {
      const near1 = v.filter((c) => Math.abs(Math.abs(c) - 1) < tolerance).length;
      const near0 = v.filter((c) => Math.abs(c) < tolerance).length;
      return near1 === 1 && near0 === 2;
    };
    return isUnitAxis(orientation.row) && isUnitAxis(orientation.column) && isUnitAxis(orientation.slice);
  }

  /**
   * Assemble 3D volume data from slices
   */
  private static assembleVolumeData(files: DicomFile[]): {
    data: Int16Array | Uint16Array;
    dataRange: { min: number; max: number };
  } {
    if (files.length === 0) {
      throw new Error('No files to assemble');
    }

    const first = files[0]!;
    const { rows, columns, pixelRepresentation } = first.metadata;

    // Determine array type based on pixel representation
    const isSigned = pixelRepresentation === 1;
    const sliceSize = rows * columns;
    const volumeSize = sliceSize * files.length;

    // Allocate volume
    const data = isSigned
      ? new Int16Array(volumeSize)
      : new Uint16Array(volumeSize);

    let min = Infinity;
    let max = -Infinity;

    // Copy slice data
    for (let z = 0; z < files.length; z++) {
      const file = files[z]!;
      const pixelData = file.pixelData;

      // Create view of pixel data as Int16 or Uint16
      const sliceData = isSigned
        ? new Int16Array(pixelData)
        : new Uint16Array(pixelData);

      // Copy to volume
      const offset = z * sliceSize;
      data.set(sliceData.subarray(0, sliceSize), offset);

      // Track min/max
      for (let i = 0; i < sliceSize; i++) {
        const value = sliceData[i]!;
        if (value < min) min = value;
        if (value > max) max = value;
      }
    }

    return {
      data,
      dataRange: { min, max },
    };
  }

  /**
   * Apply rescale slope/intercept to convert to Hounsfield Units (for CT)
   */
  static applyRescale(
    data: Int16Array | Uint16Array,
    slope: number,
    intercept: number
  ): Int16Array {
    const result = new Int16Array(data.length);

    for (let i = 0; i < data.length; i++) {
      const value = data[i]!;
      result[i] = Math.round(value * slope + intercept);
    }

    return result;
  }

  /**
   * Calculate volume bounds in world space
   */
  static calculateBounds(volume: Volume): {
    min: [number, number, number];
    max: [number, number, number];
  } {
    const { origin, dimensions, spacing } = volume;

    const max: [number, number, number] = [
      origin[0] + dimensions.x * spacing.x,
      origin[1] + dimensions.y * spacing.y,
      origin[2] + dimensions.z * spacing.z,
    ];

    return {
      min: origin,
      max,
    };
  }
}
