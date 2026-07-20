/**
 * Tests for Zustand store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import type { DicomFile } from '@/types';

describe('Zustand Store', () => {
  beforeEach(() => {
    // Reset store state between tests
    useStore.setState({
      // UI state
      isLoading: false,
      progress: null,
      errors: [],
      skippedFiles: [],
      activePanel: null,

      // Study state
      studies: new Map(),
      activeSeriesUID: null,
      files: [],
      volumes: new Map(),
    });
  });

  describe('UI State', () => {
    it('should set loading state', () => {
      const { setLoading } = useStore.getState();

      setLoading(true);
      expect(useStore.getState().isLoading).toBe(true);

      setLoading(false);
      expect(useStore.getState().isLoading).toBe(false);
    });

    it('should set progress', () => {
      const { setProgress } = useStore.getState();

      const progress = {
        stage: 'parsing' as const,
        current: 5,
        total: 10,
        message: 'Parsing files...',
      };

      setProgress(progress);
      expect(useStore.getState().progress).toEqual(progress);
    });

    it('should clear progress', () => {
      const { setProgress } = useStore.getState();

      setProgress({ stage: 'parsing', current: 5, total: 10, message: 'Test' });
      setProgress(null);

      expect(useStore.getState().progress).toBeNull();
    });

    it('should add errors', () => {
      const { addError } = useStore.getState();

      const error1 = {
        id: '1',
        code: 'PARSE_ERROR',
        message: 'Test error 1',
        recoverable: true,
        timestamp: new Date(),
      };

      const error2 = {
        id: '2',
        code: 'PARSE_ERROR',
        message: 'Test error 2',
        recoverable: true,
        timestamp: new Date(),
      };

      addError(error1);
      expect(useStore.getState().errors).toHaveLength(1);

      addError(error2);
      expect(useStore.getState().errors).toHaveLength(2);
      expect(useStore.getState().errors).toContain(error1);
      expect(useStore.getState().errors).toContain(error2);
    });

    it('should clear errors', () => {
      const { addError, clearErrors } = useStore.getState();

      addError({
        id: '1',
        code: 'PARSE_ERROR',
        message: 'Test',
        recoverable: true,
        timestamp: new Date(),
      });

      clearErrors();
      expect(useStore.getState().errors).toHaveLength(0);
    });

    it('should skip files', () => {
      const { skipFile } = useStore.getState();

      skipFile('file1.dcm');
      skipFile('file2.dcm');

      const skipped = useStore.getState().skippedFiles;
      expect(skipped).toHaveLength(2);
      expect(skipped).toContain('file1.dcm');
      expect(skipped).toContain('file2.dcm');
    });

    it('should set active panel', () => {
      const { setActivePanel } = useStore.getState();

      setActivePanel('metadata');
      expect(useStore.getState().activePanel).toBe('metadata');

      setActivePanel('settings');
      expect(useStore.getState().activePanel).toBe('settings');

      setActivePanel(null);
      expect(useStore.getState().activePanel).toBeNull();
    });
  });

  describe('Study State', () => {
    const mockDicomFile: DicomFile = {
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
      },
      pixelData: new ArrayBuffer(0),
      fileName: 'test.dcm',
      fileSize: 1024,
    };

    it('should add files', () => {
      const { addFiles } = useStore.getState();

      addFiles([mockDicomFile]);
      expect(useStore.getState().files).toHaveLength(1);
      expect(useStore.getState().files[0]).toEqual(mockDicomFile);
    });

    it('should append files', () => {
      const { addFiles } = useStore.getState();

      const file2 = { ...mockDicomFile, fileName: 'test2.dcm' };

      addFiles([mockDicomFile]);
      addFiles([file2]);

      expect(useStore.getState().files).toHaveLength(2);
    });

    it('should set studies map', () => {
      const { setStudies } = useStore.getState();

      const studies = new Map();
      studies.set('study-1', {
        studyInstanceUID: 'study-1',
        series: new Map(),
        seriesCount: 0,
        totalInstances: 0,
      });

      setStudies(studies);
      expect(useStore.getState().studies).toEqual(studies);
    });

    it('should set active series UID', () => {
      const { setActiveSeriesUID } = useStore.getState();

      setActiveSeriesUID('series-123');
      expect(useStore.getState().activeSeriesUID).toBe('series-123');

      setActiveSeriesUID(null);
      expect(useStore.getState().activeSeriesUID).toBeNull();
    });

    it('should clear all data', () => {
      const { addFiles, setActiveSeriesUID, clearAll } = useStore.getState();

      addFiles([mockDicomFile]);
      setActiveSeriesUID('series-1');

      clearAll();

      const state = useStore.getState();
      expect(state.files).toHaveLength(0);
      expect(state.studies.size).toBe(0);
      expect(state.activeSeriesUID).toBeNull();
      expect(state.volumes.size).toBe(0);
    });
  });

  describe('Selectors', () => {
    it('should select loading state', () => {
      useStore.setState({ isLoading: true });

      const isLoading = useStore.getState().isLoading;
      expect(isLoading).toBe(true);
    });

    it('should select progress', () => {
      const progress = {
        stage: 'parsing' as const,
        current: 5,
        total: 10,
        message: 'Test',
      };

      useStore.setState({ progress });

      const selectedProgress = useStore.getState().progress;
      expect(selectedProgress).toEqual(progress);
    });

    it('should select errors', () => {
      const errors = [
        {
          id: '1',
          code: 'PARSE_ERROR',
          message: 'Test',
          recoverable: true,
          timestamp: new Date(),
        },
      ];

      useStore.setState({ errors });

      const selectedErrors = useStore.getState().errors;
      expect(selectedErrors).toEqual(errors);
    });
  });
});
