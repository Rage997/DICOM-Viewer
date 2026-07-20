/**
 * Tests for DICOM error handling
 */

import { describe, it, expect } from 'vitest';
import {
  DicomError,
  DicomErrorCode,
  DicomErrorSeverity,
  createDicomWarning,
  createCriticalDicomError,
  isDicomError,
} from './DicomError';

describe('DicomError', () => {
  describe('constructor', () => {
    it('should create error with correct properties', () => {
      const error = new DicomError(
        DicomErrorCode.PARSE_ERROR,
        'Test error message',
        {
          file: 'test.dcm',
          recoverable: true,
        }
      );

      expect(error.code).toBe(DicomErrorCode.PARSE_ERROR);
      expect(error.message).toBe('Test error message');
      expect(error.file).toBe('test.dcm');
      expect(error.recoverable).toBe(true);
      expect(error.severity).toBe(DicomErrorSeverity.ERROR);
    });

    it('should have default severity of ERROR', () => {
      const error = new DicomError(DicomErrorCode.PARSE_ERROR, 'Test');
      expect(error.severity).toBe(DicomErrorSeverity.ERROR);
    });

    it('should be recoverable by default', () => {
      const error = new DicomError(DicomErrorCode.PARSE_ERROR, 'Test');
      expect(error.recoverable).toBe(true);
    });

    it('should include timestamp', () => {
      const error = new DicomError(DicomErrorCode.PARSE_ERROR, 'Test');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should store context', () => {
      const context = { tagCount: 150, hasPixelData: false };
      const error = new DicomError(DicomErrorCode.PARSE_ERROR, 'Test', {
        context,
      });
      expect(error.context).toEqual(context);
    });
  });

  describe('toDisplayString', () => {
    it('should format error for display', () => {
      const error = new DicomError(
        DicomErrorCode.PARSE_ERROR,
        'Parse failed',
        {
          file: 'test.dcm',
          context: { reason: 'bad data' },
        }
      );

      const display = error.toDisplayString();
      expect(display).toContain('Parse failed');
      expect(display).toContain('test.dcm');
      expect(display).toContain('reason');
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON', () => {
      const error = new DicomError(DicomErrorCode.PARSE_ERROR, 'Test', {
        file: 'test.dcm',
      });

      const json = error.toJSON();
      expect(json).toHaveProperty('name', 'DicomError');
      expect(json).toHaveProperty('code', DicomErrorCode.PARSE_ERROR);
      expect(json).toHaveProperty('message', 'Test');
      expect(json).toHaveProperty('file', 'test.dcm');
    });
  });

  describe('createDicomWarning', () => {
    it('should create warning with correct severity', () => {
      const warning = createDicomWarning(
        DicomErrorCode.MISSING_REQUIRED_TAGS,
        'Missing UID'
      );

      expect(warning.severity).toBe(DicomErrorSeverity.WARNING);
      expect(warning.recoverable).toBe(true);
    });
  });

  describe('createCriticalDicomError', () => {
    it('should create critical error with correct properties', () => {
      const error = createCriticalDicomError(
        DicomErrorCode.MEMORY_ERROR,
        'Out of memory'
      );

      expect(error.severity).toBe(DicomErrorSeverity.CRITICAL);
      expect(error.recoverable).toBe(false);
    });
  });

  describe('isDicomError', () => {
    it('should identify DicomError instances', () => {
      const error = new DicomError(DicomErrorCode.PARSE_ERROR, 'Test');
      expect(isDicomError(error)).toBe(true);
    });

    it('should not identify regular errors as DicomError', () => {
      const error = new Error('Regular error');
      expect(isDicomError(error)).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(isDicomError(null)).toBe(false);
      expect(isDicomError(undefined)).toBe(false);
    });

    it('should handle non-error values', () => {
      expect(isDicomError('string')).toBe(false);
      expect(isDicomError(123)).toBe(false);
      expect(isDicomError({})).toBe(false);
    });
  });
});
