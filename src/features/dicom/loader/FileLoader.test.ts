/**
 * Tests for FileLoader
 */

import { describe, it, expect, vi } from 'vitest';
import { FileLoader } from './FileLoader';

describe('FileLoader', () => {
  describe('validateFiles', () => {
    it('should accept files with .dcm extension', () => {
      const file = new File(['test'], 'scan.dcm', { type: 'application/dicom' });
      const { valid, invalid } = FileLoader.validateFiles([file]);

      expect(valid).toHaveLength(1);
      expect(invalid).toHaveLength(0);
      expect(valid[0]?.file.name).toBe('scan.dcm');
    });

    it('should accept files with .dicom extension', () => {
      const file = new File(['test'], 'scan.dicom', { type: 'application/dicom' });
      const { valid, invalid } = FileLoader.validateFiles([file]);

      expect(valid).toHaveLength(1);
      expect(invalid).toHaveLength(0);
    });

    it('should accept files without extension', () => {
      const file = new File(['test'], 'dicom_test_file', { type: '' });
      const { valid, invalid } = FileLoader.validateFiles([file]);

      expect(valid).toHaveLength(1);
      expect(invalid).toHaveLength(0);
    });

    it('should reject files with wrong extension', () => {
      const file = new File(['test'], 'document.txt', { type: 'text/plain' });
      const { valid, invalid } = FileLoader.validateFiles([file]);

      expect(valid).toHaveLength(0);
      expect(invalid).toHaveLength(1);
      expect(invalid[0]?.reason).toContain('Not a DICOM file');
    });

    it('should reject empty files', () => {
      const file = new File([], 'empty.dcm', { type: 'application/dicom' });
      const { valid, invalid } = FileLoader.validateFiles([file]);

      expect(valid).toHaveLength(0);
      expect(invalid).toHaveLength(1);
      expect(invalid[0]?.reason).toContain('Empty file');
    });

    it('should reject files larger than 100MB', () => {
      // Create a mock file with size > 100MB
      const largeSize = 101 * 1024 * 1024; // 101MB
      const file = Object.create(File.prototype);
      Object.defineProperty(file, 'size', { value: largeSize });
      Object.defineProperty(file, 'name', { value: 'large.dcm' });

      const { valid, invalid } = FileLoader.validateFiles([file]);

      expect(valid).toHaveLength(0);
      expect(invalid).toHaveLength(1);
      expect(invalid[0]?.reason).toContain('too large');
    });

    it('should handle mixed valid and invalid files', () => {
      const validFile = new File(['test'], 'valid.dcm');
      const invalidFile = new File(['test'], 'invalid.txt');

      const { valid, invalid } = FileLoader.validateFiles([validFile, invalidFile]);

      expect(valid).toHaveLength(1);
      expect(invalid).toHaveLength(1);
    });

    it('should preserve file path for folder uploads', () => {
      const file = Object.create(File.prototype);
      Object.defineProperty(file, 'size', { value: 1024 });
      Object.defineProperty(file, 'name', { value: 'scan.dcm' });
      Object.defineProperty(file, 'webkitRelativePath', { value: 'study/series1/scan.dcm' });

      const { valid } = FileLoader.validateFiles([file]);

      expect(valid[0]?.path).toBe('study/series1/scan.dcm');
    });
  });

  describe('readFile', () => {
    it('should read file as ArrayBuffer', async () => {
      const content = 'DICOM file content';
      const file = new File([content], 'test.dcm');

      const buffer = await FileLoader.readFile(file);

      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it('should reject on FileReader error', async () => {
      const file = new File(['test'], 'test.dcm');

      // Mock FileReader to simulate error
      const originalFileReader = globalThis.FileReader;
      globalThis.FileReader = class MockFileReader {
        onerror: ((event: Event) => void) | null = null;
        readAsArrayBuffer() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Event('error'));
            }
          }, 0);
        }
      } as any;

      await expect(FileLoader.readFile(file)).rejects.toThrow();

      // Restore
      globalThis.FileReader = originalFileReader;
    });
  });

  describe('openFilePicker', () => {
    it('should create input element with correct attributes', () => {
      // Mock document.createElement
      const mockInput = {
        type: '',
        multiple: false,
        accept: '',
        webkitdirectory: false,
        click: vi.fn(),
        onchange: null,
        oncancel: null,
      };

      const originalCreateElement = document.createElement;
      document.createElement = vi.fn((tag) => {
        if (tag === 'input') return mockInput as any;
        return originalCreateElement.call(document, tag);
      });

      FileLoader.openFilePicker({ multiple: true });

      expect(mockInput.type).toBe('file');
      expect(mockInput.multiple).toBe(true);
      expect(mockInput.click).toHaveBeenCalled();

      // Restore
      document.createElement = originalCreateElement;
    });
  });
});
