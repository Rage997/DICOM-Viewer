/**
 * Tests for synthetic UID generation
 */

import { describe, it, expect } from 'vitest';
import {
  generateSyntheticStudyUID,
  generateSyntheticSeriesUID,
  generateSyntheticSOPUID,
  isSyntheticUID,
} from './syntheticUIDs';

describe('Synthetic UID Generation', () => {
  describe('generateSyntheticStudyUID', () => {
    it('should generate a valid DICOM UID format', () => {
      const uid = generateSyntheticStudyUID();
      expect(uid).toMatch(/^1\.2\.826\.0\.1\.3680043\.10\.999\./);
    });

    it('should be consistent for same seed', () => {
      const uid1 = generateSyntheticStudyUID('test-seed');
      const uid2 = generateSyntheticStudyUID('test-seed');
      expect(uid1).toBe(uid2);
    });

    it('should be different for different seeds', () => {
      const uid1 = generateSyntheticStudyUID('seed1');
      const uid2 = generateSyntheticStudyUID('seed2');
      expect(uid1).not.toBe(uid2);
    });
  });

  describe('generateSyntheticSeriesUID', () => {
    it('should generate a valid DICOM UID format', () => {
      const uid = generateSyntheticSeriesUID('test-file.dcm');
      expect(uid).toMatch(/^1\.2\.826\.0\.1\.3680043\.10\.999\./);
    });

    it('should be deterministic for same filename', () => {
      const uid1 = generateSyntheticSeriesUID('test.dcm');
      const uid2 = generateSyntheticSeriesUID('test.dcm');

      // Should have same hash part
      const hash1 = uid1.split('.')[7];
      const hash2 = uid2.split('.')[7];
      expect(hash1).toBe(hash2);
    });

    it('should be different for different filenames', () => {
      const uid1 = generateSyntheticSeriesUID('file1.dcm');
      const uid2 = generateSyntheticSeriesUID('file2.dcm');
      expect(uid1).not.toBe(uid2);
    });
  });

  describe('generateSyntheticSOPUID', () => {
    it('should generate a valid DICOM UID format', () => {
      const uid = generateSyntheticSOPUID('test.dcm', 1024);
      expect(uid).toMatch(/^1\.2\.826\.0\.1\.3680043\.10\.999\./);
    });

    it('should include file size', () => {
      const uid = generateSyntheticSOPUID('test.dcm', 123456);
      expect(uid).toContain('123456');
    });

    it('should be unique for same filename but different size', () => {
      const uid1 = generateSyntheticSOPUID('test.dcm', 1000);
      const uid2 = generateSyntheticSOPUID('test.dcm', 2000);
      expect(uid1).not.toBe(uid2);
    });
  });

  describe('isSyntheticUID', () => {
    it('should identify synthetic UIDs', () => {
      const syntheticUID = generateSyntheticStudyUID();
      expect(isSyntheticUID(syntheticUID)).toBe(true);
    });

    it('should not identify real UIDs as synthetic', () => {
      const realUID = '1.2.840.113619.2.55.3.51.394820';
      expect(isSyntheticUID(realUID)).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(isSyntheticUID('')).toBe(false);
    });
  });
});
