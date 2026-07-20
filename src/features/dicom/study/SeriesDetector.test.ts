/**
 * Tests for SeriesDetector
 */

import { describe, it, expect } from 'vitest';
import { SeriesDetector } from './SeriesDetector';
import type { DicomFile } from '@/types';

const createMockDicomFile = (overrides: Partial<DicomFile['metadata']>): DicomFile => ({
  metadata: {
    studyInstanceUID: 'study-1',
    seriesInstanceUID: 'series-1',
    sopInstanceUID: 'sop-1',
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

describe('SeriesDetector', () => {
  describe('detectSeries', () => {
    it('should group files by series UID', () => {
      const files = [
        createMockDicomFile({ seriesInstanceUID: 'series-1' }),
        createMockDicomFile({ seriesInstanceUID: 'series-1' }),
        createMockDicomFile({ seriesInstanceUID: 'series-2' }),
      ];

      const seriesMap = SeriesDetector.detectSeries(files);

      expect(seriesMap.size).toBe(2);
      expect(seriesMap.get('series-1')?.instances).toHaveLength(2);
      expect(seriesMap.get('series-2')?.instances).toHaveLength(1);
    });

    it('should set correct instance count', () => {
      const files = [
        createMockDicomFile({ seriesInstanceUID: 'series-1' }),
        createMockDicomFile({ seriesInstanceUID: 'series-1' }),
        createMockDicomFile({ seriesInstanceUID: 'series-1' }),
      ];

      const seriesMap = SeriesDetector.detectSeries(files);
      const series = seriesMap.get('series-1');

      expect(series?.instanceCount).toBe(3);
    });

    it('should preserve series metadata', () => {
      const files = [
        createMockDicomFile({
          seriesInstanceUID: 'series-1',
          seriesNumber: 1,
          seriesDescription: 'Test Series',
          modality: 'MR',
        }),
      ];

      const seriesMap = SeriesDetector.detectSeries(files);
      const series = seriesMap.get('series-1');

      expect(series?.seriesNumber).toBe(1);
      expect(series?.seriesDescription).toBe('Test Series');
      expect(series?.modality).toBe('MR');
    });
  });

  describe('buildStudy', () => {
    it('should build complete study structure', () => {
      const files = [
        createMockDicomFile({
          studyInstanceUID: 'study-1',
          studyDate: '20240101',
          studyDescription: 'Test Study',
          patientName: 'Test Patient',
        }),
        createMockDicomFile({ studyInstanceUID: 'study-1' }),
      ];

      const study = SeriesDetector.buildStudy(files);

      expect(study.studyInstanceUID).toBe('study-1');
      expect(study.studyDate).toBe('20240101');
      expect(study.studyDescription).toBe('Test Study');
      expect(study.patientName).toBe('Test Patient');
      expect(study.totalInstances).toBe(2);
    });

    it('should throw on empty file list', () => {
      expect(() => SeriesDetector.buildStudy([])).toThrow();
    });
  });

  describe('validateStudyConsistency', () => {
    it('should pass for consistent study', () => {
      const files = [
        createMockDicomFile({ studyInstanceUID: 'study-1' }),
        createMockDicomFile({ studyInstanceUID: 'study-1' }),
      ];

      const result = SeriesDetector.validateStudyConsistency(files);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for mixed studies', () => {
      const files = [
        createMockDicomFile({ studyInstanceUID: 'study-1' }),
        createMockDicomFile({ studyInstanceUID: 'study-2' }),
      ];

      const result = SeriesDetector.validateStudyConsistency(files);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getSeriesStats', () => {
    it('should return correct statistics', () => {
      const series: import('@/types').DicomSeries = {
        seriesInstanceUID: 'series-1',
        modality: 'CT' as const,
        instances: [
          createMockDicomFile({
            imagePositionPatient: [0, 0, 0],
            pixelSpacing: [1, 1],
          }),
          createMockDicomFile({
            imagePositionPatient: [0, 0, 1],
            pixelSpacing: [1, 1],
          }),
        ],
        instanceCount: 2,
        isComplete: false,
      };

      const stats = SeriesDetector.getSeriesStats(series);

      expect(stats.instanceCount).toBe(2);
      expect(stats.modality).toBe('CT');
      expect(stats.hasSpatialInfo).toBe(true);
      expect(stats.hasPixelSpacing).toBe(true);
    });
  });
});
