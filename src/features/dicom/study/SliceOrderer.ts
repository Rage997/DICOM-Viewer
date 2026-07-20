/**
 * Slice Ordering - Sorts DICOM slices by spatial position
 */

import type { DicomFile } from '@/types';

/**
 * Calculate distance between two 3D points
 */
function calculateDistance(p1: [number, number, number], p2: [number, number, number]): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const dz = p2[2] - p1[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Order DICOM slices by spatial position
 */
export class SliceOrderer {
  /**
   * Order slices by ImagePositionPatient
   */
  static orderByPosition(files: DicomFile[]): DicomFile[] {
    // Filter files that have position info
    const filesWithPosition = files.filter(
      (f) => f.metadata.imagePositionPatient !== undefined
    );

    const filesWithoutPosition = files.filter(
      (f) => f.metadata.imagePositionPatient === undefined
    );

    if (filesWithPosition.length === 0) {
      // Fall back to instance number if no position info
      return this.orderByInstanceNumber(files);
    }

    // Calculate slice normal direction from first file's orientation
    const firstFile = filesWithPosition[0]!;
    const orientation = firstFile.metadata.imageOrientationPatient;

    let sliceNormal: [number, number, number];

    if (orientation) {
      // Calculate slice normal from cross product of row and column directions
      const rowDir = [orientation[0], orientation[1], orientation[2]];
      const colDir = [orientation[3], orientation[4], orientation[5]];

      // Cross product
      sliceNormal = [
        rowDir[1]! * colDir[2]! - rowDir[2]! * colDir[1]!,
        rowDir[2]! * colDir[0]! - rowDir[0]! * colDir[2]!,
        rowDir[0]! * colDir[1]! - rowDir[1]! * colDir[0]!,
      ];
    } else {
      // Default to Z-axis if orientation not available
      sliceNormal = [0, 0, 1];
    }

    // Calculate projection along slice normal for each file
    const filesWithProjection = filesWithPosition.map((file) => {
      const position = file.metadata.imagePositionPatient!;
      const projection =
        position[0] * sliceNormal[0] +
        position[1] * sliceNormal[1] +
        position[2] * sliceNormal[2];

      return { file, projection };
    });

    // Sort by projection
    filesWithProjection.sort((a, b) => a.projection - b.projection);

    // Extract sorted files
    const sortedFiles = filesWithProjection.map((item) => item.file);

    // Append files without position info at the end
    return [...sortedFiles, ...filesWithoutPosition];
  }

  /**
   * Order slices by instance number (fallback)
   */
  static orderByInstanceNumber(files: DicomFile[]): DicomFile[] {
    return [...files].sort((a, b) => {
      const numA = a.metadata.instanceNumber ?? 0;
      const numB = b.metadata.instanceNumber ?? 0;
      return numA - numB;
    });
  }

  /**
   * Calculate slice spacing
   */
  static calculateSliceSpacing(files: DicomFile[]): number | null {
    if (files.length < 2) {
      return null;
    }

    // Try to use SliceThickness first
    const firstThickness = files[0]?.metadata.sliceThickness;
    if (firstThickness !== undefined) {
      return firstThickness;
    }

    // Calculate from ImagePositionPatient
    const filesWithPosition = files.filter(
      (f) => f.metadata.imagePositionPatient !== undefined
    );

    if (filesWithPosition.length < 2) {
      return null;
    }

    // Calculate distances between consecutive slices
    const distances: number[] = [];
    for (let i = 0; i < filesWithPosition.length - 1; i++) {
      const pos1 = filesWithPosition[i]!.metadata.imagePositionPatient!;
      const pos2 = filesWithPosition[i + 1]!.metadata.imagePositionPatient!;
      distances.push(calculateDistance(pos1, pos2));
    }

    if (distances.length === 0) {
      return null;
    }

    // Return median distance (more robust than mean)
    distances.sort((a, b) => a - b);
    const mid = Math.floor(distances.length / 2);
    return distances.length % 2 === 0
      ? (distances[mid - 1]! + distances[mid]!) / 2
      : distances[mid]!;
  }

  /**
   * Check if slices are uniformly spaced
   */
  static isUniformlySpaced(files: DicomFile[], tolerance: number = 0.1): boolean {
    if (files.length < 2) {
      return true;
    }

    const filesWithPosition = files.filter(
      (f) => f.metadata.imagePositionPatient !== undefined
    );

    if (filesWithPosition.length < 2) {
      return true;
    }

    // Calculate all distances
    const distances: number[] = [];
    for (let i = 0; i < filesWithPosition.length - 1; i++) {
      const pos1 = filesWithPosition[i]!.metadata.imagePositionPatient!;
      const pos2 = filesWithPosition[i + 1]!.metadata.imagePositionPatient!;
      distances.push(calculateDistance(pos1, pos2));
    }

    if (distances.length === 0) {
      return true;
    }

    // Calculate mean
    const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;

    // Check if all distances are within tolerance of mean
    return distances.every((d) => Math.abs(d - mean) <= tolerance);
  }

  /**
   * Detect missing slices
   */
  static detectMissingSlices(files: DicomFile[]): number[] {
    if (files.length < 2) {
      return [];
    }

    const spacing = this.calculateSliceSpacing(files);
    if (spacing === null) {
      return [];
    }

    const filesWithPosition = files.filter(
      (f) => f.metadata.imagePositionPatient !== undefined
    );

    if (filesWithPosition.length < 2) {
      return [];
    }

    const missing: number[] = [];

    for (let i = 0; i < filesWithPosition.length - 1; i++) {
      const pos1 = filesWithPosition[i]!.metadata.imagePositionPatient!;
      const pos2 = filesWithPosition[i + 1]!.metadata.imagePositionPatient!;
      const distance = calculateDistance(pos1, pos2);

      // Check if gap is larger than expected spacing
      const expectedGap = spacing;
      const actualGap = distance;

      if (actualGap > expectedGap * 1.5) {
        // Likely missing slice(s)
        const missingCount = Math.round(actualGap / expectedGap) - 1;
        for (let j = 0; j < missingCount; j++) {
          missing.push(i + 1);
        }
      }
    }

    return missing;
  }
}
