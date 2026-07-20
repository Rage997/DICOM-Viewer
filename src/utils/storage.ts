/**
 * Namespaced localStorage flags for one-shot UI state (e.g. "first-run hint seen").
 *
 * Wrapped in try/catch: some privacy configurations make localStorage throw on
 * access. On failure reads report "not set" and writes are dropped, so a feature
 * gated on a flag degrades to always-on rather than crashing.
 */

const PREFIX = 'omp.dicom.';

export function getFlag(key: string): boolean {
  try {
    return localStorage.getItem(PREFIX + key) === '1';
  } catch {
    return false;
  }
}

export function setFlag(key: string, value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(PREFIX + key, '1');
    } else {
      localStorage.removeItem(PREFIX + key);
    }
  } catch {
    // localStorage unavailable — flag simply won't persist.
  }
}
