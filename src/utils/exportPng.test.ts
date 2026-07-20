import { describe, it, expect } from 'vitest';
import { exportFilename, buildCaption, buildStudyInfo } from './exportPng';

describe('exportPng helpers', () => {
  describe('exportFilename', () => {
    it('builds a timestamped, orientation-tagged .png name', () => {
      const date = new Date('2026-07-16T22:30:05.123Z');
      expect(exportFilename('axial', date)).toBe('dicom-axial-2026-07-16_22-30-05.png');
      expect(exportFilename('3d', date)).toBe('dicom-3d-2026-07-16_22-30-05.png');
      expect(exportFilename('collage', date)).toBe('dicom-collage-2026-07-16_22-30-05.png');
    });
  });

  describe('buildCaption', () => {
    it('includes orientation, slice, and W/L', () => {
      expect(
        buildCaption({
          orientation: 'axial',
          windowLevel: 40,
          windowWidth: 400,
          slice: { index: 7, total: 20 },
        })
      ).toBe('Axial  ·  Slice 7/20  ·  W/L 40/400');
    });

    it('omits slice when absent (e.g. 3D)', () => {
      expect(buildCaption({ orientation: '3d' })).toBe('3D');
    });

    it('omits W/L when not provided', () => {
      expect(buildCaption({ orientation: 'coronal', slice: { index: 1, total: 5 } })).toBe(
        'Coronal  ·  Slice 1/5'
      );
    });

    it('rounds fractional W/L values', () => {
      expect(buildCaption({ orientation: 'sagittal', windowLevel: 39.6, windowWidth: 400.4 })).toBe(
        'Sagittal  ·  W/L 40/400'
      );
    });
  });

  describe('buildStudyInfo', () => {
    const full = {
      patientName: 'DOE^JANE',
      patientId: 'MRN123',
      patientSex: 'F',
      patientBirthDate: '19800215',
      studyDate: '20260716',
      studyDescription: 'BRAIN MRI',
      modality: 'MR',
      dimensions: { x: 256, y: 256, z: 20 },
      spacing: { x: 0.5, y: 0.5, z: 1 },
      windowLevel: 40,
      windowWidth: 400,
    };

    it('full header includes identity + technical, dates reformatted', () => {
      const [identity, technical] = buildStudyInfo(full, { anonymize: false });
      expect(identity).toBe('DOE^JANE  ·  ID MRN123  ·  F  ·  DOB 1980-02-15');
      expect(technical).toBe(
        '2026-07-16  ·  MR  ·  BRAIN MRI  ·  256×256×20  ·  0.5×0.5×1 mm  ·  W/L 40/400'
      );
    });

    it('anonymized drops name/ID/DOB but keeps sex + all technical', () => {
      const [identity, technical] = buildStudyInfo(full, { anonymize: true });
      expect(identity).toBe('De-identified  ·  F');
      expect(technical).toBe(
        '2026-07-16  ·  MR  ·  BRAIN MRI  ·  256×256×20  ·  0.5×0.5×1 mm  ·  W/L 40/400'
      );
    });

    it('omits missing fields; falls back for unknown patient', () => {
      const [identity, technical] = buildStudyInfo(
        { modality: 'CT', dimensions: { x: 512, y: 512, z: 130 } },
        { anonymize: false }
      );
      expect(identity).toBe('Unknown patient');
      expect(technical).toBe('CT  ·  512×512×130');
    });
  });
});
