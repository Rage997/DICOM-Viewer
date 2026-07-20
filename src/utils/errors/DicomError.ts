/**
 * Custom error types for DICOM processing
 */

/**
 * Error codes for DICOM operations
 */
export enum DicomErrorCode {
  // File-level errors
  INVALID_FILE = 'INVALID_FILE',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  NOT_DICOM = 'NOT_DICOM',

  // Parsing errors
  PARSE_ERROR = 'PARSE_ERROR',
  UNSUPPORTED_TRANSFER_SYNTAX = 'UNSUPPORTED_TRANSFER_SYNTAX',
  CORRUPT_DATA = 'CORRUPT_DATA',

  // Metadata errors
  MISSING_REQUIRED_TAGS = 'MISSING_REQUIRED_TAGS',
  INVALID_METADATA = 'INVALID_METADATA',

  // Study reconstruction errors
  INCONSISTENT_DIMENSIONS = 'INCONSISTENT_DIMENSIONS',
  INCONSISTENT_SPACING = 'INCONSISTENT_SPACING',
  MISSING_SPATIAL_INFO = 'MISSING_SPATIAL_INFO',
  DUPLICATE_INSTANCE = 'DUPLICATE_INSTANCE',

  // Memory errors
  MEMORY_ERROR = 'MEMORY_ERROR',
  TEXTURE_TOO_LARGE = 'TEXTURE_TOO_LARGE',

  // Rendering errors
  WEBGL_ERROR = 'WEBGL_ERROR',
  WEBGPU_ERROR = 'WEBGPU_ERROR',
  SHADER_COMPILE_ERROR = 'SHADER_COMPILE_ERROR',
}

/**
 * Error severity level
 */
export enum DicomErrorSeverity {
  /** Warning - operation can continue, but user should be aware */
  WARNING = 'warning',

  /** Error - operation failed, but other operations can continue */
  ERROR = 'error',

  /** Critical - operation failed and application state may be compromised */
  CRITICAL = 'critical',
}

/**
 * Custom error class for DICOM operations
 */
export class DicomError extends Error {
  /** Error code for programmatic handling */
  code: DicomErrorCode;

  /** Severity level */
  severity: DicomErrorSeverity;

  /** Whether the operation can continue without this failing */
  recoverable: boolean;

  /** File that caused the error (if applicable) */
  file?: string;

  /** Additional context for debugging */
  context?: Record<string, unknown>;

  /** Timestamp when error occurred */
  timestamp: Date;

  constructor(
    code: DicomErrorCode,
    message: string,
    options?: {
      severity?: DicomErrorSeverity;
      recoverable?: boolean;
      file?: string;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);

    this.name = 'DicomError';
    this.code = code;
    this.severity = options?.severity ?? DicomErrorSeverity.ERROR;
    this.recoverable = options?.recoverable ?? true;
    this.file = options?.file;
    this.context = options?.context;
    this.timestamp = new Date();

    // Maintain proper stack trace (Node.js and V8 environments)
    if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, DicomError);
    }

    // Store cause if provided (ES2022 feature)
    if (options?.cause) {
      (this as Error & { cause?: Error }).cause = options.cause;
    }
  }

  /**
   * Create a formatted error message for display
   */
  toDisplayString(): string {
    let display = `${this.message}`;

    if (this.file) {
      display += `\n\nFile: ${this.file}`;
    }

    if (this.context) {
      const contextStr = Object.entries(this.context)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n');

      display += `\n\nDetails:\n${contextStr}`;
    }

    return display;
  }

  /**
   * Create a JSON representation for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      recoverable: this.recoverable,
      file: this.file,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * Create a warning-level DICOM error
 */
export function createDicomWarning(
  code: DicomErrorCode,
  message: string,
  options?: Omit<ConstructorParameters<typeof DicomError>[2], 'severity'>
): DicomError {
  return new DicomError(code, message, {
    ...options,
    severity: DicomErrorSeverity.WARNING,
    recoverable: true,
  });
}

/**
 * Create a critical DICOM error
 */
export function createCriticalDicomError(
  code: DicomErrorCode,
  message: string,
  options?: Omit<ConstructorParameters<typeof DicomError>[2], 'severity' | 'recoverable'>
): DicomError {
  return new DicomError(code, message, {
    ...options,
    severity: DicomErrorSeverity.CRITICAL,
    recoverable: false,
  });
}

/**
 * Type guard to check if error is a DicomError
 */
export function isDicomError(error: unknown): error is DicomError {
  return error instanceof DicomError;
}
