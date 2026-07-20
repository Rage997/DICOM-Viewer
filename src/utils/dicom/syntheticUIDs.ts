/**
 * Generate synthetic UIDs for DICOM files with missing metadata
 * OID prefix: 1.2.826.0.1.3680043.10.999 (reserved for development/private use)
 */

/**
 * Generate a simple hash from string
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString();
}

/**
 * Generate timestamp component for uniqueness
 */
function getTimestamp(): string {
  return Date.now().toString().slice(-8); // Last 8 digits
}

/**
 * Generate synthetic Study Instance UID
 * Same for all files in a batch (by default)
 */
export function generateSyntheticStudyUID(seed?: string): string {
  const timestamp = getTimestamp();
  const hashPart = seed ? simpleHash(seed) : timestamp;
  return `1.2.826.0.1.3680043.10.999.${hashPart}.1`;
}

/**
 * Generate synthetic Series Instance UID
 */
export function generateSyntheticSeriesUID(fileName: string): string {
  const hash = simpleHash(fileName);
  const timestamp = getTimestamp();
  return `1.2.826.0.1.3680043.10.999.${hash}.${timestamp}.2`;
}

/**
 * Generate synthetic SOP Instance UID (unique per file)
 */
export function generateSyntheticSOPUID(fileName: string, fileSize: number): string {
  const hash = simpleHash(fileName + fileSize.toString());
  const timestamp = getTimestamp();
  return `1.2.826.0.1.3680043.10.999.${hash}.${timestamp}.${fileSize}`;
}

/**
 * Check if UID is synthetic
 */
export function isSyntheticUID(uid: string): boolean {
  return uid.includes('1.2.826.0.1.3680043.10.999');
}
