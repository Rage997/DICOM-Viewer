/**
 * File System API type declarations
 * For drag-and-drop folder support
 */

interface FileSystemEntry {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly name: string;
  readonly fullPath: string;
}

interface FileSystemFileEntry extends FileSystemEntry {
  readonly isFile: true;
  readonly isDirectory: false;
  file(successCallback: (file: File) => void, errorCallback?: (error: Error) => void): void;
}

interface FileSystemDirectoryEntry extends FileSystemEntry {
  readonly isFile: false;
  readonly isDirectory: true;
  createReader(): FileSystemDirectoryReader;
}

interface FileSystemDirectoryReader {
  readEntries(
    successCallback: (entries: FileSystemEntry[]) => void,
    errorCallback?: (error: Error) => void
  ): void;
}

interface DataTransferItem {
  webkitGetAsEntry(): FileSystemEntry | null;
}

interface HTMLInputElement {
  webkitdirectory?: boolean;
}

// --- File System Access API (showDirectoryPicker) ---
// Not present in the TS DOM lib; declared here for folder selection without the
// browser's "upload all files / only if you trust this site" warning.
interface FileSystemHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file';
  getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: 'directory';
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
}

interface Window {
  showDirectoryPicker?(options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
  }): Promise<FileSystemDirectoryHandle>;
}
