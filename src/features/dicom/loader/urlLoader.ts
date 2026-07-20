/**
 * URL loader - fetches a ZIP archive of DICOM files from a URL and unpacks it
 * into File objects for the standard loading pipeline. Enables demo mode and
 * loading hosted studies via a `?url=` parameter.
 */

import { unzipSync } from 'fflate';
import { DicomError, DicomErrorCode } from '@/utils/errors/DicomError';

/** Progress while downloading the archive. `total` is 0 when unknown (no Content-Length). */
export interface DownloadProgress {
  loaded: number;
  total: number;
}

/**
 * Fetch a URL into a Uint8Array, streaming the body so we can report byte-level
 * download progress. Falls back to a single arrayBuffer read if the body is not
 * streamable.
 */
async function fetchBytes(
  url: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetch(url, { mode: 'cors' });
  } catch (cause) {
    // Network error or CORS rejection — fetch throws a TypeError with no detail.
    throw new DicomError(
      DicomErrorCode.FILE_READ_ERROR,
      `Could not fetch "${url}". The host may be unreachable or blocking cross-origin requests (CORS).`,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }

  if (!response.ok) {
    throw new DicomError(
      DicomErrorCode.FILE_READ_ERROR,
      `Failed to download "${url}": HTTP ${response.status} ${response.statusText}.`
    );
  }

  const total = Number(response.headers.get('Content-Length')) || 0;

  // Stream the body for progress reporting when possible.
  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.length;
        onProgress?.({ loaded, total });
      }
    }

    // Concatenate chunks into one buffer.
    const size = chunks.reduce((sum, c) => sum + c.length, 0);
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }

  // Fallback: no streamable body.
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  onProgress?.({ loaded: bytes.length, total: bytes.length });
  return bytes;
}

/** True for archive entries that are real files (not directories or OS junk). */
function isUsableEntry(name: string): boolean {
  if (name.endsWith('/')) return false; // directory
  const base = name.split('/').pop() ?? name;
  if (base === '') return false;
  if (base.startsWith('.')) return false; // .DS_Store and other dotfiles
  if (name.startsWith('__MACOSX/')) return false; // macOS resource forks
  return true;
}

/**
 * Download a ZIP of DICOM files from a URL and return them as File objects.
 * Directory prefixes inside the archive are flattened to basenames; the standard
 * pipeline validates/parses them exactly like drag-and-dropped files.
 */
export async function loadDicomZipFromUrl(
  url: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<File[]> {
  const bytes = await fetchBytes(url, onProgress);

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, { filter: (file) => isUsableEntry(file.name) });
  } catch (cause) {
    throw new DicomError(
      DicomErrorCode.FILE_READ_ERROR,
      `Downloaded data from "${url}" is not a valid ZIP archive.`,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }

  const files: File[] = [];
  for (const [name, data] of Object.entries(entries)) {
    const base = name.split('/').pop() ?? name;
    files.push(new File([data as BlobPart], base));
  }

  if (files.length === 0) {
    throw new DicomError(
      DicomErrorCode.INVALID_FILE,
      `The archive at "${url}" contained no files.`
    );
  }

  return files;
}
