/**
 * File loader - handles file/folder input, validation, and reading
 */

import { DicomError, DicomErrorCode } from '@/utils/errors/DicomError';

/**
 * Valid DICOM file extensions
 */
const DICOM_EXTENSIONS = ['.dcm', '.dicom', '.dic', ''];

/**
 * Check if a file is likely a DICOM file based on extension
 */
function isLikelyDicom(filename: string): boolean {
  const lower = filename.toLowerCase();

  // Check explicit extensions
  if (DICOM_EXTENSIONS.some(ext => ext && lower.endsWith(ext))) {
    return true;
  }

  // DICOM files often have no extension
  // Accept files without extensions that don't have other known extensions
  const hasExtension = /\.[a-z0-9]{1,4}$/i.test(filename);
  return !hasExtension;
}

/**
 * File with metadata for loading
 */
export interface FileToLoad {
  file: File;
  path: string; // Relative path for folder uploads
}

/**
 * Result of file validation
 */
export interface ValidationResult {
  valid: FileToLoad[];
  invalid: Array<{ file: File; reason: string }>;
}

/**
 * File loader class
 */
export class FileLoader {
  /**
   * Extract files from DataTransferItemList (supports folders)
   */
  static async extractFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
    const files: File[] = [];
    const items = Array.from(dataTransfer.items);

    // Process each item (could be file or directory)
    const processEntry = async (entry: FileSystemEntry): Promise<void> => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject);
        });
        files.push(file);
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();

        // Read all entries in directory (may need multiple calls)
        const readEntries = async (): Promise<FileSystemEntry[]> => {
          return new Promise((resolve, reject) => {
            reader.readEntries(resolve, reject);
          });
        };

        let entries = await readEntries();
        while (entries.length > 0) {
          for (const entry of entries) {
            await processEntry(entry);
          }
          entries = await readEntries();
        }
      }
    };

    // Process all items
    for (const item of items) {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        await processEntry(entry);
      }
    }

    return files;
  }

  /**
   * Validate and filter files
   */
  static validateFiles(files: File[]): ValidationResult {
    const valid: FileToLoad[] = [];
    const invalid: Array<{ file: File; reason: string }> = [];

    for (const file of files) {
      // Check if it's a file (not directory)
      if (file.size === 0) {
        invalid.push({ file, reason: 'Empty file or directory' });
        continue;
      }

      // Check if it's likely a DICOM file
      if (!isLikelyDicom(file.name)) {
        invalid.push({ file, reason: 'Not a DICOM file (wrong extension)' });
        continue;
      }

      // Check file size (warn if > 100MB per file)
      if (file.size > 100 * 1024 * 1024) {
        invalid.push({ file, reason: 'File too large (>100MB)' });
        continue;
      }

      valid.push({
        file,
        path: file.webkitRelativePath || file.name,
      });
    }

    return { valid, invalid };
  }

  /**
   * Read a file as ArrayBuffer
   */
  static async readFile(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(
            new DicomError(
              DicomErrorCode.FILE_READ_ERROR,
              'Failed to read file as ArrayBuffer',
              { file: file.name }
            )
          );
        }
      };

      reader.onerror = () => {
        reject(
          new DicomError(
            DicomErrorCode.FILE_READ_ERROR,
            `Failed to read file: ${reader.error?.message || 'Unknown error'}`,
            { file: file.name, cause: reader.error || undefined }
          )
        );
      };

      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Read multiple files in parallel (with concurrency limit)
   */
  static async readFiles(
    files: FileToLoad[],
    onProgress?: (current: number, total: number) => void,
    concurrency: number = 4
  ): Promise<Array<{ file: FileToLoad; data: ArrayBuffer | Error }>> {
    const results: Array<{ file: FileToLoad; data: ArrayBuffer | Error }> = [];
    let completed = 0;

    // Process files in batches
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map(async (fileToLoad) => {
          try {
            const data = await this.readFile(fileToLoad.file);
            return { file: fileToLoad, data };
          } catch (error) {
            return {
              file: fileToLoad,
              data: error instanceof Error ? error : new Error('Unknown error'),
            };
          }
        })
      );

      results.push(...batchResults);
      completed += batch.length;

      if (onProgress) {
        onProgress(completed, files.length);
      }
    }

    return results;
  }

  /**
   * Handle file input from drag & drop or file picker
   */
  static async processFileInput(
    input: FileList | File[],
    onProgress?: (current: number, total: number, stage: string) => void
  ): Promise<{
    success: Array<{ file: FileToLoad; data: ArrayBuffer }>;
    errors: Array<{ file: string; error: Error }>;
  }> {
    const fileArray = Array.from(input);

    // Stage 1: Validation
    onProgress?.(0, fileArray.length, 'Validating files...');
    const { valid, invalid } = this.validateFiles(fileArray);

    const errors: Array<{ file: string; error: Error }> = invalid.map((item) => ({
      file: item.file.name,
      error: new DicomError(
        DicomErrorCode.INVALID_FILE,
        item.reason,
        { file: item.file.name, recoverable: true }
      ),
    }));

    if (valid.length === 0) {
      return { success: [], errors };
    }

    // Stage 2: Reading files
    onProgress?.(0, valid.length, 'Reading files...');
    const readResults = await this.readFiles(
      valid,
      (current, total) => onProgress?.(current, total, 'Reading files...'),
      4 // 4 concurrent reads
    );

    // Separate successes and errors
    const success: Array<{ file: FileToLoad; data: ArrayBuffer }> = [];

    for (const result of readResults) {
      if (result.data instanceof Error) {
        errors.push({
          file: result.file.file.name,
          error: result.data,
        });
      } else {
        success.push({
          file: result.file,
          data: result.data,
        });
      }
    }

    return { success, errors };
  }

  /**
   * Open file picker dialog
   */
  static async openFilePicker(options?: {
    multiple?: boolean;
    directory?: boolean;
  }): Promise<FileList | File[] | null> {
    // Folders: prefer the File System Access API. It has no "upload all files /
    // only if you trust this site" warning and keeps everything client-side.
    if (options?.directory && typeof window.showDirectoryPicker === 'function') {
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        return await this.collectFilesFromDirectory(dirHandle);
      } catch (error) {
        // User dismissed the picker — treat as no selection.
        if (error instanceof DOMException && error.name === 'AbortError') {
          return null;
        }
        throw error;
      }
    }

    // Fallback: hidden <input>. For a folder in browsers without the File System
    // Access API this still shows the native directory-upload warning (which is
    // not suppressible on the input element).
    const { promise, resolve } = Promise.withResolvers<FileList | null>();
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options?.multiple ?? true;

    if (options?.directory) {
      input.webkitdirectory = true;
    }

    // Note: many DICOM files have no extension, so the picker is not restricted
    // with an `accept` filter.
    input.onchange = () => resolve(input.files);
    input.oncancel = () => resolve(null);
    input.click();

    return promise;
  }

  /**
   * Recursively collect every file under a directory handle (File System Access API).
   */
  private static async collectFilesFromDirectory(
    dirHandle: FileSystemDirectoryHandle
  ): Promise<File[]> {
    const files: File[] = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        files.push(await entry.getFile());
      } else {
        files.push(...(await this.collectFilesFromDirectory(entry)));
      }
    }
    return files;
  }
}
