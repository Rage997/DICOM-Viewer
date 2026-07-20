/**
 * Error dialog for DICOM loading errors
 * Professional, technical, user makes the decision
 */

import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface ErrorDialogProps {
  errors: Array<{
    file: string;
    error: Error;
  }>;
  onSkipFile: (file: string) => void;
  onSkipAll: () => void;
  onStop: () => void;
}

export function ErrorDialog({ errors, onSkipFile, onSkipAll, onStop }: ErrorDialogProps) {
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());

  if (errors.length === 0) return null;

  const currentError = errors[0];
  const remainingCount = errors.length - 1;

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedErrors(newExpanded);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-red-900/50 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-neutral-800 px-6 py-4">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h2 className="text-base font-semibold text-neutral-100">
            Error Loading DICOM File
          </h2>
          {remainingCount > 0 && (
            <span className="ml-auto text-xs text-neutral-500">
              +{remainingCount} more
            </span>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Current error */}
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-neutral-500">File</div>
              <div className="mt-1 font-mono text-sm text-neutral-200">
                {currentError?.file}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-neutral-500">Error</div>
              <div className="mt-1 text-sm text-red-400">
                {currentError?.error.message}
              </div>

              {/* Show error code */}
              {currentError?.error.name && currentError.error.name !== 'Error' && (
                <div className="mt-1 font-mono text-xs text-neutral-600">
                  Code: {currentError.error.name}
                </div>
              )}
            </div>

            {/* Suggestions based on error type */}
            {currentError?.error.name === 'MISSING_REQUIRED_TAGS' && (
              <div className="rounded border border-blue-900/50 bg-blue-950/20 p-3 text-sm text-blue-400">
                <div className="flex items-start gap-2">
                  <span className="text-lg">💡</span>
                  <div>
                    <strong className="text-blue-300">What to do:</strong>
                    <p className="mt-1 text-blue-400/90">
                      {currentError.error.message.includes('DICOMDIR')
                        ? 'Look for numbered files in the same folder (e.g., IM-0001-0001, CT000001, or files with .dcm extension).'
                        : currentError.error.message.includes('Structured Report')
                        ? 'This is a text report. Look for the actual scan images in the same folder or parent directory.'
                        : 'This file does not contain viewable image data. Look for other files in the same folder that might be the actual images.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentError?.error.name === 'PARSE_ERROR' && (
              <div className="rounded border border-yellow-900/50 bg-yellow-950/20 p-3 text-xs text-yellow-500">
                <strong>Possible causes:</strong>
                <ul className="mt-1 ml-4 list-disc space-y-0.5">
                  <li>File uses compressed transfer syntax (not yet supported)</li>
                  <li>File encoding is corrupted</li>
                  <li>File is from older DICOM standard</li>
                </ul>
              </div>
            )}

            {/* Technical details (expandable) */}
            <div>
              <button
                onClick={() => toggleExpanded(0)}
                className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-400"
              >
                {expandedErrors.has(0) ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Technical Details
              </button>

              {expandedErrors.has(0) && (
                <div className="mt-2 space-y-2">
                  <pre className="overflow-x-auto rounded border border-neutral-800 bg-black p-3 text-xs text-neutral-400">
                    {JSON.stringify(
                      {
                        name: currentError?.error.name,
                        message: currentError?.error.message,
                        // @ts-ignore - accessing custom context property
                        context: currentError?.error.context || undefined,
                        stack: currentError?.error.stack?.split('\n').slice(0, 5).join('\n'),
                      },
                      null,
                      2
                    )}
                  </pre>

                  {/* Show help text */}
                  <div className="text-xs text-neutral-600">
                    Check the browser console (F12) for more detailed diagnostic information.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-neutral-800 px-6 py-4">
          <button
            onClick={onStop}
            className="rounded px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
          >
            Stop Loading
          </button>

          {errors.length > 1 && (
            <button
              onClick={onSkipAll}
              className="rounded bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              Skip All Errors ({remainingCount})
            </button>
          )}

          <button
            onClick={() => currentError && onSkipFile(currentError.file)}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Skip This File
          </button>
        </div>
      </div>
    </div>
  );
}
