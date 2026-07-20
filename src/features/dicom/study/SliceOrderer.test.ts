/**
 * Tests for SliceOrderer
 */

import { describe, it, expect } from 'vitest';
import { SliceOrderer } from './SliceOrderer';
import type { DicomFile } from '@/types';

const createMockDicomFile = (overrides: Partial<DicomFile['metadata']>): DicomFile => ({
  metadata: {
    studyInstanceUID: 'study-1',
    seriesInstanceUID: 'series-1',
    sopInstanceUID: `sop-${Math.random()}`,
    modality: 'CT',
    rows: 512,
    columns: 512,
    bitsAllocated: 16,
    bitsStored: 16,
    pixelRepresentation: 0,
    samplesPerPixel: 1,
    photometricInterpretation: 'MONOCHROME2',
    ...overrides,
  },
  pixelData: new ArrayBuffer(0),
  fileName: 'test.dcm',
  fileSize: 1024,
});

describe('SliceOrderer', () => {
  describe('orderByPosition', () => {
    it('should order slices by Z position', () => {
      const files = [
        createMockDicomFile({ imagePositionPatient: [0, 0, 2], instanceNumber: 3 }),
        createMockDicomFile({ imagePositionPatient: [0, 0, 0], instanceNumber: 1 }),
        createMockDicomFile({ imagePositionPatient: [0, 0, 1], instanceNumber: 2 }),
      ];

      const ordered = SliceOrderer.orderByPosition(files);

      expect(ordered[0]?.metadata.imagePositionPatient?.[2]).toBe(0);
      expect(ordered[1]?.metadata.imagePositionPatient?.[2]).toBe(1);
      expect(ordered[2]?.metadata.imagePositionPatient?.[2]).toBe(2);
    });

    it('should fall back to instance number when no position', () => {
      const files = [
        createMockDicomFile({ instanceNumber: 3 }),
        createMockDicomFile({ instanceNumber: 1 }),
        createMockDicomFile({ instanceNumber: 2 }),
      ];

      const ordered = SliceOrderer.orderByPosition(files);

      expect(ordered[0]?.metadata.instanceNumber).toBe(1);
      expect(ordered[1]?.metadata.instanceNumber).toBe(2);
      expect(ordered[2]?.metadata.instanceNumber).toBe(3);
    });
  });

  describe('orderByInstanceNumber', () => {
    it('should order by instance number', () => {
      const files = [
        createMockDicomFile({ instanceNumber: 30 }),
        createMockDicomFile({ instanceNumber: 10 }),
        createMockDicomFile({ instanceNumber: 20 }),
      ];

      const ordered = SliceOrderer.orderByInstanceNumber(files);

      expect(ordered[0]?.metadata.instanceNumber).toBe(10);
      expect(ordered[1]?.metadata.instanceNumber).toBe(20);
      expect(ordered[2]?.metadata.instanceNumber).toBe(30);
    });

    it('should handle missing instance numbers', () => {
      const files = [
        createMockDicomFile({ instanceNumber: 2 }),
        createMockDicomFile({ instanceNumber: undefined }),
        createMockDicomFile({ instanceNumber: 1 }),
      ];

      const ordered = SliceOrderer.orderByInstanceNumber(files);

      expect(ordered[0]?.metadata.instanceNumber).toBe(undefined);
      expect(ordered[1]?.metadata.instanceNumber).toBe(1);
      expect(ordered[2]?.metadata.instanceNumber).toBe(2);
    });
  });

  describe('calculateSliceSpacing', () => {
    it('should use slice thickness if available', () => {
      const files = [
        createMockDicomFile({ sliceThickness: 5.0 }),
        createMockDicomFile({ sliceThickness: 5.0 }),
      ];

      const spacing = SliceOrderer.calculateSliceSpacing(files);

      expect(spacing).toBe(5.0);
    });

    it('should calculate from positions', () => {
      const files = [
        createMockDicomFile({ imagePositionPatient: [0, 0, 0] }),
        createMockDicomFile({ imagePositionPatient: [0, 0, 5] }),
        createMockDicomFile({ imagePositionPatient: [0, 0, 10] }),
      ];

      const spacing = SliceOrderer.calculateSliceSpacing(files);

      expect(spacing).toBeCloseTo(5.0, 1);
    });

    it('should return null for insufficient data', () => {
      const files = [createMockDicomFile({})];

      const spacing = SliceOrderer.calculateSliceSpacing(files);

      expect(spacing).toBeNull();
    });
  });

  describe('isUniformlySpaced', () => {
    it('should return true for uniform spacing', () => {
      const files = [
        createMockDicomFile({ imagePositionPatient: [0, 0, 0] }),
        createMockDicomFile({ imagePositionPatient: [0, 0, 5] }),
        createMockDicomFile({ imagePositionPatient: [0, 0, 10] }),
      ];

      const uniform = SliceOrderer.isUniformlySpaced(files);

      expect(uniform).toBe(true);
    });

    it('should return false for non-uniform spacing', () => {
      const files = [
        createMockDicomFile({ imagePositionPatient: [0, 0, 0] }),
        createMockDicomFile({ imagePositionPatient: [0, 0, 5] }),
        createMockDicomFile({ imagePositionPatient: [0, 0, 12] }),
      ];

      const uniform = SliceOrderer.isUniformlySpaced(files);

      expect(uniform).toBe(false);
    });
  });

  describe('detectMissingSlices', () => {
    it('should detect missing slices with sufficient gap', () => {
      // Create files with explicit slice thickness
      const files = [
        createMockDicomFile({ imagePositionPatient: [0, 0, 0], sliceThickness: 5.0 }),
        createMockDicomFile({ imagePositionPatient: [0, 0, 5], sliceThickness: 5.0 }),
        createMockDicomFile({ imagePositionPatient: [0, 0, 15], sliceThickness: 5.0 }), // Gap: 10mm (2 slices missing)
      ];

      // Order files first
      const ordered = SliceOrderer.orderByPosition(files);
      const missing = SliceOrderer.detectMissingSlices(ordered);

      // Should detect at least one missing slice
      expect(missing.length).toBeGreaterThan(0);
    });

    it('should return empty for complete series', () => {
      const files = [
        createMockDicomFile({ imagePositionPatient: [0, 0, 0] }),
        createMockDicomFile({ imagePositionPatient: [0, 0, 5] }),
        createMockDicomFile({ imagePositionPatient: [0, 0, 10] }),
      ];

      const missing = SliceOrderer.detectMissingSlices(files);

      expect(missing).toHaveLength(0);
    });
  });
});
