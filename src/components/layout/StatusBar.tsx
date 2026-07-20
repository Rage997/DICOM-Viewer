/**
 * Bottom status bar
 * Technical information, no fluff
 */

import type { LoadingProgress } from '@/state/slices/uiSlice';

interface StatusBarProps {
  backend: string;
  windowLevel?: number;
  windowWidth?: number;
  sliceCount?: number;
  status: 'ready' | 'loading' | 'error';
  progress?: LoadingProgress | null;
}

export function StatusBar({
  backend: _backend, // Hidden from status bar, available in info dialog
  windowLevel,
  windowWidth,
  sliceCount,
  status,
  progress,
}: StatusBarProps) {
  return (
    <div className="flex h-6 items-center gap-4 border-t border-neutral-800 bg-neutral-900 px-3 text-xs font-mono">
      {/* Window/Level - Medical-relevant */}
      {windowLevel !== undefined && windowWidth !== undefined && (
        <>
          <span className="text-neutral-400">
            W/L: <span className="text-neutral-200">{windowLevel.toFixed(0)}</span> /{' '}
            <span className="text-neutral-200">{windowWidth.toFixed(0)}</span>
          </span>
          <div className="h-3 w-px bg-neutral-800" />
        </>
      )}

      {/* Slice count - Medical-relevant */}
      {sliceCount !== undefined && (
        <>
          <span className="text-neutral-400">
            <span className="text-neutral-200">{sliceCount}</span> slices
          </span>
          <div className="h-3 w-px bg-neutral-800" />
        </>
      )}

      <div className="flex-1" />

      {/* Progress bar (when loading) */}
      {progress && status === 'loading' && (
        <>
          <span className="text-neutral-400">{progress.message}</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full bg-blue-500 transition-all duration-200"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                }}
              />
            </div>
            <span className="text-neutral-500">
              {progress.current}/{progress.total}
            </span>
          </div>
          <div className="h-3 w-px bg-neutral-800" />
        </>
      )}

      {/* Status - Only show when loading or error */}
      {status === 'loading' && (
        <span className="text-blue-500">Loading...</span>
      )}
      {status === 'error' && (
        <span className="text-red-500">Error</span>
      )}
    </div>
  );
}
