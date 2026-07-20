/**
 * Volume Navigation Controls
 * Medical-imaging-friendly 3D navigation with anatomical presets
 */

import { Home, ZoomIn, ZoomOut } from 'lucide-react';

interface VolumeNavigationControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onSetView: (view: 'anterior' | 'posterior' | 'left' | 'right' | 'superior' | 'inferior') => void;
}

export function VolumeNavigationControls({
  onZoomIn,
  onZoomOut,
  onReset,
  onSetView,
}: VolumeNavigationControlsProps) {
  return (
    <div className="absolute right-4 top-4 z-10 flex flex-col gap-3">
      {/* Zoom Controls */}
      <div className="flex flex-col gap-1 rounded-lg bg-black/80 p-2 backdrop-blur-sm">
        <button
          onClick={onZoomIn}
          className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-700 text-white transition-colors hover:bg-neutral-600"
          title="Zoom In"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        <button
          onClick={onZoomOut}
          className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-700 text-white transition-colors hover:bg-neutral-600"
          title="Zoom Out"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <button
          onClick={onReset}
          className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-700 text-white transition-colors hover:bg-neutral-600"
          title="Reset View"
        >
          <Home className="h-5 w-5" />
        </button>
      </div>

      {/* Anatomical View Presets */}
      <div className="rounded-lg bg-black/80 p-2 backdrop-blur-sm">
        <div className="mb-2 px-2 text-xs font-medium text-neutral-400">
          ANATOMICAL VIEWS
        </div>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => onSetView('anterior')}
            className="rounded-md bg-neutral-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-600"
            title="Anterior (Front) View"
          >
            Front
          </button>
          <button
            onClick={() => onSetView('posterior')}
            className="rounded-md bg-neutral-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-600"
            title="Posterior (Back) View"
          >
            Back
          </button>
          <button
            onClick={() => onSetView('left')}
            className="rounded-md bg-neutral-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-600"
            title="Left Lateral View"
          >
            Left
          </button>
          <button
            onClick={() => onSetView('right')}
            className="rounded-md bg-neutral-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-600"
            title="Right Lateral View"
          >
            Right
          </button>
          <button
            onClick={() => onSetView('superior')}
            className="rounded-md bg-neutral-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-600"
            title="Superior (Top) View"
          >
            Top
          </button>
          <button
            onClick={() => onSetView('inferior')}
            className="rounded-md bg-neutral-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-600"
            title="Inferior (Bottom) View"
          >
            Bottom
          </button>
        </div>
      </div>
    </div>
  );
}
