/**
 * Tests for VolumeBuilder
 */

import { describe, it, expect } from 'vitest';
import { VolumeBuilder } from './VolumeBuilder';
import type { DicomFile, DicomSeries } from '@/types';

const createMockDicomFile = (overrides: Partial<DicomFile['metadata']>): DicomFile => {
  // Create small pixel data (4x4 = 16 pixels)
  const pixelData = new Int16Array(16).fill(100);

  return {
    metadata: {
      studyInstanceUID: 'study-1',
      seriesInstanceUID: 'series-1',
      sopInstanceUID: `sop-${Math.random()}`,
      modality: 'CT',
      rows: 4,
      columns: 4,
      bitsAllocated: 16,
      bitsStored: 16,
      pixelRepresentation: 1, // Signed
      samplesPerPixel: 1,
      photometricInterpretation: 'MONOCHROME2',
      rescaleSlope: 1,
      rescaleIntercept: -1024,
      pixelSpacing: [1.0, 1.0],
      ...overrides,
    },
    pixelData: pixelData.buffer,
    fileName: 'test.dcm',
    fileSize: pixelData.byteLength,
  };
};

describe('VolumeBuilder', () => {
  describe('buildVolume', () => {
    it('should build volume from series', () => {
      const series: DicomSeries = {
        seriesInstanceUID: 'series-1',
        modality: 'CT',
        instances: [
          createMockDicomFile({ imagePositionPatient: [0, 0, 0] }),
          createMockDicomFile({ imagePositionPatient: [0, 0, 1] }),
        ],
        instanceCount: 2,
        isComplete: true,
      };

      const volume = VolumeBuilder.buildVolume(series);

      expect(volume.dimensions).toEqual({ x: 4, y: 4, z: 2 });
      expect(volume.modality).toBe('CT');
      expect(volume.seriesInstanceUID).toBe('series-1');
    });

    it('should set correct spacing', () => {
      const series: DicomSeries = {
        seriesInstanceUID: 'series-1',
        modality: 'CT',
        instances: [
          createMockDicomFile({
            pixelSpacing: [0.5, 0.5],
            imagePositionPatient: [0, 0, 0],
          }),
          createMockDicomFile({
            pixelSpacing: [0.5, 0.5],
            imagePositionPatient: [0, 0, 2],
          }),
        ],
        instanceCount: 2,
        isComplete: true,
      };

      const volume = VolumeBuilder.buildVolume(series);

      expect(volume.spacing.x).toBe(0.5);
      expect(volume.spacing.y).toBe(0.5);
      expect(volume.spacing.z).toBeCloseTo(2.0, 1);
    });

    it('maps anisotropic pixel spacing to x/y without swapping (DICOM row/col order)', () => {
      const series: DicomSeries = {
        seriesInstanceUID: 'series-1',
        modality: 'CT',
        instances: [
          // PixelSpacing = [rowSpacing, colSpacing] = [2, 0.5]
          createMockDicomFile({ pixelSpacing: [2, 0.5], imagePositionPatient: [0, 0, 0] }),
          createMockDicomFile({ pixelSpacing: [2, 0.5], imagePositionPatient: [0, 0, 3] }),
        ],
        instanceCount: 2,
        isComplete: true,
      };

      const volume = VolumeBuilder.buildVolume(series);

      // x = columns = colSpacing (index 1); y = rows = rowSpacing (index 0)
      expect(volume.spacing.x).toBe(0.5);
      expect(volume.spacing.y).toBe(2);
    });

    it('should throw on empty series', () => {
      const series: DicomSeries = {
        seriesInstanceUID: 'series-1',
        modality: 'CT',
        instances: [],
        instanceCount: 0,
        isComplete: false,
      };

      expect(() => VolumeBuilder.buildVolume(series)).toThrow();
    });

    it('should throw on inconsistent dimensions', () => {
      const series: DicomSeries = {
        seriesInstanceUID: 'series-1',
        modality: 'CT',
        instances: [
          createMockDicomFile({ rows: 512, columns: 512 }),
          createMockDicomFile({ rows: 256, columns: 256 }), // Different!
        ],
        instanceCount: 2,
        isComplete: false,
      };

      expect(() => VolumeBuilder.buildVolume(series)).toThrow(/Inconsistent dimensions/);
    });
  });

  describe('isAxisAligned', () => {
    it('accepts the identity (axial) orientation', () => {
      expect(
        VolumeBuilder.isAxisAligned({ row: [1, 0, 0], column: [0, 1, 0], slice: [0, 0, 1] })
      ).toBe(true);
    });

    it('accepts signed unit axes (e.g. flipped)', () => {
      expect(
        VolumeBuilder.isAxisAligned({ row: [1, 0, 0], column: [0, -1, 0], slice: [0, 0, -1] })
      ).toBe(true);
    });

    it('rejects an oblique orientation', () => {
      const c = Math.SQRT1_2; // 45° in-plane rotation
      expect(
        VolumeBuilder.isAxisAligned({ row: [c, c, 0], column: [-c, c, 0], slice: [0, 0, 1] })
      ).toBe(false);
    });
  });

  describe('applyRescale', () => {
    it('should apply rescale to data', () => {
      const data = new Uint16Array([0, 100, 200]);
      const slope = 1;
      const intercept = -1024;

      const result = VolumeBuilder.applyRescale(data, slope, intercept);

      expect(result[0]).toBe(-1024);
      expect(result[1]).toBe(-924);
      expect(result[2]).toBe(-824);
    });
  });

  describe('calculateBounds', () => {
    it('should calculate world space bounds', () => {
      const volume = VolumeBuilder.buildVolume({
        seriesInstanceUID: 'series-1',
        modality: 'CT',
        instances: [
          createMockDicomFile({
            imagePositionPatient: [10, 20, 30],
            pixelSpacing: [2, 2],
            rows: 4,
            columns: 4,
          }),
          createMockDicomFile({
            imagePositionPatient: [10, 20, 32],
            pixelSpacing: [2, 2],
          }),
        ],
        instanceCount: 2,
        isComplete: true,
      });

      const bounds = VolumeBuilder.calculateBounds(volume);

      expect(bounds.min).toEqual([10, 20, 30]);
      // max = origin + dimensions * spacing
      // x: 10 + 4 * 2 = 18
      // y: 20 + 4 * 2 = 28
      // z: 30 + 2 * 2 = 34
      expect(bounds.max[0]).toBeCloseTo(18, 0);
      expect(bounds.max[1]).toBeCloseTo(28, 0);
      expect(bounds.max[2]).toBeGreaterThan(30);
    });
  });
});
