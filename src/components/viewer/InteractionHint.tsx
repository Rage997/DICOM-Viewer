/**
 * First-run "How to Navigate" modal.
 *
 * Shows once ever (dismissal persisted in localStorage by the caller). Content is
 * the shared ControlsReference — 3D view, 2D slices, and preset shortcuts — so it
 * stays in sync with the Help → Controls dialog.
 */

import { ControlsReference } from '@/components/common/ControlsReference';

interface InteractionHintProps {
  onDismiss: () => void;
}

export function InteractionHint({ onDismiss }: InteractionHintProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div
        className="max-h-[85vh] max-w-md overflow-y-auto rounded-xl border border-white/20 bg-neutral-900/95 px-8 py-6 shadow-2xl backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()} // Don't dismiss when clicking inside
      >
        <div className="flex flex-col gap-4">
          <div className="text-lg font-semibold text-white">How to Navigate</div>

          <ControlsReference />

          <button
            onClick={onDismiss}
            className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
          >
            Got it
          </button>

          <div className="text-center text-xs text-neutral-500">Click anywhere to dismiss</div>
        </div>
      </div>
    </div>
  );
}
