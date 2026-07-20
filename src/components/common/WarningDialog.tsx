/**
 * Warning dialog for incomplete DICOM files
 * User decides whether to proceed with synthetic metadata
 */

import { AlertTriangle } from 'lucide-react';

interface FileWithWarnings {
  fileName: string;
  warnings: string[];
}

interface WarningDialogProps {
  files: FileWithWarnings[];
  onProceed: () => void;
  onReject: () => void;
}

export function WarningDialog({ files, onProceed, onReject }: WarningDialogProps) {
  if (files.length === 0) return null;

  const totalWarnings = files.reduce((sum, f) => sum + f.warnings.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-yellow-900/50 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-neutral-800 px-6 py-4">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <h2 className="text-base font-semibold text-neutral-100">
            Incomplete DICOM Metadata
          </h2>
          <span className="ml-auto text-xs text-neutral-500">
            {files.length} file{files.length > 1 ? 's' : ''}, {totalWarnings} warning
            {totalWarnings > 1 ? 's' : ''}
          </span>
        </div>

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto px-6 py-4">
          <div className="mb-4 rounded-lg border border-yellow-900/30 bg-yellow-950/10 p-3 text-sm text-yellow-400">
            <p className="font-medium">
              These files are missing required DICOM metadata (Study/Series/SOP UIDs).
            </p>
            <p className="mt-2 text-xs text-yellow-500/80">
              We can still display them by generating synthetic identifiers, but they may not
              organize correctly with other files.
            </p>
          </div>

          {/* Files list */}
          <div className="space-y-3">
            {files.map((file, index) => (
              <div key={index} className="rounded border border-neutral-800 bg-black/20 p-3">
                <div className="font-mono text-sm text-neutral-200">{file.fileName}</div>
                <ul className="mt-2 space-y-1">
                  {file.warnings.map((warning, wIndex) => (
                    <li key={wIndex} className="text-xs text-neutral-500">
                      • {warning}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Explanation */}
          <div className="mt-4 space-y-2 text-xs text-neutral-500">
            <p>
              <strong className="text-neutral-400">What this means:</strong>
            </p>
            <ul className="ml-4 space-y-1 list-disc">
              <li>Files will be viewable but may not group correctly</li>
              <li>Each file will be treated as a separate series</li>
              <li>3D volume reconstruction may not work across files</li>
              <li>Synthetic UIDs will be used for organization</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-neutral-800 px-6 py-4">
          <div className="text-xs text-neutral-500">
            Recommended: Proceed only if pixel data is intact
          </div>

          <div className="flex gap-2">
            <button
              onClick={onReject}
              className="rounded px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
            >
              Reject Files
            </button>

            <button
              onClick={onProceed}
              className="rounded bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 transition-colors"
            >
              Proceed Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
