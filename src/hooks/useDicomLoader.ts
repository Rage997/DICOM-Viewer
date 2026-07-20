/**
 * DICOM Loader Hook
 * Orchestrates file loading, parsing, and error handling
 */

import { useCallback, useRef, useState } from 'react';
import { useStore } from '@/state/store';
import { FileLoader } from '@/features/dicom/loader/FileLoader';
import { WorkerPool } from '@/workers/WorkerPool';
import type { DicomFile } from '@/types';

interface LoadResult {
  success: DicomFile[];
  errors: Array<{ file: string; error: Error }>;
}

export function useDicomLoader() {
  const workerPoolRef = useRef<WorkerPool | null>(null);
  const [activeErrors, setActiveErrors] = useState<Array<{ file: string; error: Error }>>([]);
  const [filesWithWarnings, setFilesWithWarnings] = useState<DicomFile[]>([]);
  const [pendingFilesCallback, setPendingFilesCallback] = useState<(() => void) | null>(null);
  const [shouldStop, setShouldStop] = useState(false);

  const setLoading = useStore((state) => state.setLoading);
  const setProgress = useStore((state) => state.setProgress);
  const addFiles = useStore((state) => state.addFiles);
  const skipFile = useStore((state) => state.skipFile);

  // Initialize worker pool on first use
  const getWorkerPool = useCallback(() => {
    if (!workerPoolRef.current) {
      workerPoolRef.current = new WorkerPool();
    }
    return workerPoolRef.current;
  }, []);

  /**
   * Load DICOM files from FileList
   */
  const loadFiles = useCallback(
    async (input: FileList | File[]): Promise<LoadResult> => {
      setShouldStop(false);
      setLoading(true);
      setActiveErrors([]);

      try {
        // Stage 1: Read files
        setProgress({
          stage: 'validating',
          current: 0,
          total: input.length,
          message: 'Validating files...',
        });

        const { success: fileData, errors: readErrors } = await FileLoader.processFileInput(
          input,
          (current, total, stage) => {
            setProgress({
              stage: 'validating',
              current,
              total,
              message: stage,
            });
          }
        );

        // Check if user wants to stop
        if (shouldStop) {
          setLoading(false);
          setProgress(null);
          return { success: [], errors: readErrors };
        }

        if (fileData.length === 0) {
          setLoading(false);
          setProgress(null);
          setActiveErrors(readErrors);
          return { success: [], errors: readErrors };
        }

        // Stage 2: Parse DICOM files
        setProgress({
          stage: 'parsing',
          current: 0,
          total: fileData.length,
          message: 'Parsing DICOM files...',
        });

        const workerPool = getWorkerPool();
        const { success: parsedFiles, errors: parseErrors } = await workerPool.parseMultiple(
          fileData.map((item) => ({
            fileName: item.file.file.name,
            data: item.data,
          })),
          (current, total) => {
            setProgress({
              stage: 'parsing',
              current,
              total,
              message: `Parsing DICOM files... (${current}/${total})`,
            });
          }
        );

        // Combine all errors
        const allErrors = [...readErrors, ...parseErrors];

        // Check for files with warnings (incomplete metadata)
        const filesWithWarnings = parsedFiles.filter((file) => file.warnings && file.warnings.length > 0);
        const filesWithoutWarnings = parsedFiles.filter((file) => !file.warnings || file.warnings.length === 0);

        // Add files without warnings immediately
        if (filesWithoutWarnings.length > 0) {
          addFiles(filesWithoutWarnings);
        }

        // If there are files with warnings, show warning dialog
        if (filesWithWarnings.length > 0) {
          setFilesWithWarnings(filesWithWarnings);
          // Store callback to add files if user approves
          setPendingFilesCallback(() => () => {
            addFiles(filesWithWarnings);
            setFilesWithWarnings([]);
            setPendingFilesCallback(null);
          });
        }

        // Stage 3: Complete
        setProgress({
          stage: 'complete',
          current: parsedFiles.length,
          total: fileData.length,
          message: `Loaded ${parsedFiles.length} files`,
        });

        // Show errors if any
        if (allErrors.length > 0) {
          setActiveErrors(allErrors);
        }

        setLoading(false);

        return {
          success: parsedFiles,
          errors: allErrors,
        };
      } catch (error) {
        console.error('Failed to load DICOM files:', error);
        setLoading(false);
        setProgress(null);

        const errorItem = {
          file: 'Unknown',
          error: error instanceof Error ? error : new Error('Unknown error'),
        };

        setActiveErrors([errorItem]);

        return {
          success: [],
          errors: [errorItem],
        };
      }
    },
    [setLoading, setProgress, addFiles, getWorkerPool, shouldStop]
  );

  /**
   * Open file picker and load selected files
   */
  const openFilePicker = useCallback(
    async (options?: { directory?: boolean }) => {
      const files = await FileLoader.openFilePicker({
        multiple: true,
        directory: options?.directory,
      });

      if (files && files.length > 0) {
        return loadFiles(files);
      }

      return { success: [], errors: [] };
    },
    [loadFiles]
  );

  /**
   * Handle error dialog actions
   */
  const handleSkipFile = useCallback(
    (filename: string) => {
      skipFile(filename);
      setActiveErrors((errors) => errors.filter((e) => e.file !== filename));
    },
    [skipFile]
  );

  const handleSkipAllErrors = useCallback(() => {
    activeErrors.forEach((error) => skipFile(error.file));
    setActiveErrors([]);
  }, [activeErrors, skipFile]);

  const handleStopLoading = useCallback(() => {
    setShouldStop(true);
    setActiveErrors([]);
    setLoading(false);
    setProgress(null);
  }, [setLoading, setProgress]);

  /**
   * Handle warning dialog actions
   */
  const handleProceedWithWarnings = useCallback(() => {
    if (pendingFilesCallback) {
      pendingFilesCallback();
    }
  }, [pendingFilesCallback]);

  const handleRejectWarnings = useCallback(() => {
    // Log rejected files
    filesWithWarnings.forEach((file) => {
      console.warn(`User rejected file with warnings: ${file.fileName}`);
      skipFile(file.fileName);
    });
    setFilesWithWarnings([]);
    setPendingFilesCallback(null);
  }, [filesWithWarnings, skipFile]);

  /**
   * Cleanup worker pool
   */
  const cleanup = useCallback(() => {
    if (workerPoolRef.current) {
      workerPoolRef.current.terminate();
      workerPoolRef.current = null;
    }
  }, []);

  return {
    loadFiles,
    openFilePicker,
    activeErrors,
    filesWithWarnings,
    handleSkipFile,
    handleSkipAllErrors,
    handleStopLoading,
    handleProceedWithWarnings,
    handleRejectWarnings,
    cleanup,
  };
}
