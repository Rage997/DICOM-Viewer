import { useState, useEffect, useRef } from 'react';
import type { SliceOrientation, Volume } from '@/types';
import { VolumeCanvas } from './VolumeCanvas';
import { SliceCanvas } from './SliceCanvas';
import { SliceControls } from './SliceControls';
import { WindowLevelHUD } from './WindowLevelHUD';
import { isArrowKeyTarget } from '@/utils/keyboard';
import { useStore } from '@/state/store';

// Window-level nudge per Up/Down arrow press (Hounsfield units for CT).
const WL_LEVEL_STEP = 10;

interface ViewportProps {
  orientation?: SliceOrientation | '3d';
  isEmpty?: boolean;
  onDrop?: (dataTransfer: DataTransfer) => void;
  onLoadDemo?: () => void;
  volume?: Volume | null;
  windowLevel?: number;
  windowWidth?: number;
  onWindowLevelChange?: (level: number, width: number) => void;
  isActive?: boolean;
  onSelect?: () => void;
}

export function Viewport({
  orientation,
  isEmpty = true,
  onDrop,
  onLoadDemo,
  volume,
  windowLevel = 40,
  windowWidth = 400,
  onWindowLevelChange,
  isActive = false,
  onSelect,
}: ViewportProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentSlice, setCurrentSlice] = useState(0);
  const [totalSlices, setTotalSlices] = useState(0);
  const [isAdjustingWL, setIsAdjustingWL] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  // Set slice count + center on the middle slice whenever the plane or volume
  // changes. Promoting a pane to primary switches its orientation, so it must
  // re-center rather than keep the previous plane's slice index.
  useEffect(() => {
    if (!volume || !orientation || orientation === '3d') {
      setTotalSlices(0);
      setCurrentSlice(0);
      return;
    }

    const total =
      orientation === 'axial'
        ? volume.dimensions.z
        : orientation === 'sagittal'
        ? volume.dimensions.x
        : volume.dimensions.y;

    setTotalSlices(total);
    setCurrentSlice(total > 0 ? Math.floor(total / 2) : 0);
  }, [volume, orientation]);

  // Consume a pending jump-to-measurement: when this pane matches the target
  // series + plane, jump to its slice and clear the request (one-shot). Runs
  // after the centering effect above so it wins on a series switch.
  const focusTarget = useStore((s) => s.focusTarget);
  const setFocusTarget = useStore((s) => s.setFocusTarget);
  useEffect(() => {
    if (!focusTarget || !volume || !orientation || orientation === '3d') return;
    if (focusTarget.seriesInstanceUID !== volume.seriesInstanceUID) return;
    if (focusTarget.orientation !== orientation) return;
    const total =
      orientation === 'axial'
        ? volume.dimensions.z
        : orientation === 'sagittal'
        ? volume.dimensions.x
        : volume.dimensions.y;
    setCurrentSlice(Math.max(0, Math.min(focusTarget.sliceIndex, total - 1)));
    setFocusTarget(null);
  }, [focusTarget, volume, orientation, setFocusTarget]);


  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (onDrop) {
      onDrop(e.dataTransfer);
    }
  };

  // Click-to-select the primary pane. Guarded by movement so it never fires on a
  // window/level drag (SliceCanvas) or a 3D rotate/pan — those move well past 6px.
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    const start = pointerDownPos.current;
    pointerDownPos.current = null;
    if (!start || !onSelect) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx * dx + dy * dy <= 36) onSelect(); // within ~6px → treat as a click
  };

  const handleSliceChange = (slice: number) => {
    // Clamp so wheel / arrow / slider can never drive the counter out of range.
    setCurrentSlice(Math.max(0, Math.min(slice, totalSlices - 1)));
  };

  const handleWindowLevelChange = (level: number, width: number) => {
    setIsAdjustingWL(true);
    if (onWindowLevelChange) {
      onWindowLevelChange(level, width);
    }
  };

  // Hide W/L HUD after delay
  useEffect(() => {
    if (isAdjustingWL) {
      const timer = setTimeout(() => setIsAdjustingWL(false), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isAdjustingWL, windowLevel, windowWidth]);

  // Arrow keys on the hovered slice viewport: Left/Right = prev/next slice,
  // Up/Down = brightness (window level). Mirrors wheel (down/next) and drag
  // (up = brighter). 3D and empty viewports opt out.
  useEffect(() => {
    const isSliceView = !!orientation && orientation !== '3d' && !isEmpty;
    if (!isHovered || !isSliceView) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isArrowKeyTarget(e.target)) return;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setCurrentSlice((c) => Math.max(0, Math.min(c + 1, totalSlices - 1)));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentSlice((c) => Math.max(0, Math.min(c - 1, totalSlices - 1)));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setIsAdjustingWL(true);
          onWindowLevelChange?.(windowLevel + WL_LEVEL_STEP, windowWidth);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setIsAdjustingWL(true);
          onWindowLevelChange?.(windowLevel - WL_LEVEL_STEP, windowWidth);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHovered, isEmpty, orientation, totalSlices, windowLevel, windowWidth, onWindowLevelChange]);

  const getOrientationLabel = () => {
    if (!orientation) return '';
    if (orientation === '3d') return '3D View';
    if (orientation === 'axial') return 'Axial View';
    if (orientation === 'sagittal') return 'Sagittal View';
    if (orientation === 'coronal') return 'Coronal View';
    return orientation;
  };


  return (
    <div
      className={`
        relative flex h-full w-full flex-col overflow-hidden bg-black
        ${isDragOver ? 'ring-2 ring-blue-500 ring-inset' : isActive ? 'ring-1 ring-blue-500/60 ring-inset' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      data-viewport={!isEmpty && orientation ? orientation : undefined}
      data-slice={
        !isEmpty && orientation && orientation !== '3d' && totalSlices > 0
          ? `${currentSlice + 1}/${totalSlices}`
          : undefined
      }
    >
      {/* Orientation Label */}
      {orientation && !isEmpty && (
        <div className="absolute left-3 top-3 z-10 select-none text-xs font-medium text-white/80 bg-black/40 px-2 py-1 rounded">
          {getOrientationLabel()}
        </div>
      )}

      {/* Canvas / Content Area */}
      <div className="flex flex-1 items-center justify-center relative">
        {isEmpty && (
          <div className="flex flex-col items-center gap-3 text-center">
            {orientation === 'axial' && (
              <>
                <div className="text-sm font-medium text-neutral-400">
                  Drop your scan folder here
                </div>
                <div className="text-xs text-neutral-600">or use Open Folder button</div>
                {onLoadDemo && (
                  <>
                    <div className="mt-1 text-xs text-neutral-700">— or —</div>
                    <button
                      type="button"
                      onClick={onLoadDemo}
                      className="mt-1 rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/20 hover:text-blue-200"
                    >
                      Load demo dataset (Brain MRI)
                    </button>
                  </>
                )}
              </>
            )}
            {orientation !== 'axial' && (
              <div className="text-xs text-neutral-600">
                Waiting for study...
              </div>
            )}
          </div>
        )}

        {!isEmpty && orientation === '3d' && (
          <VolumeCanvas volume={volume ?? null} />
        )}

        {!isEmpty && orientation && orientation !== '3d' && (
          <SliceCanvas
            volume={volume ?? null}
            orientation={orientation}
            windowLevel={windowLevel}
            windowWidth={windowWidth}
            sliceIndex={currentSlice}
            onWindowLevelChange={handleWindowLevelChange}
            onSliceChange={handleSliceChange}
          />
        )}

        {/* Window/Level HUD */}
        {!isEmpty && orientation !== '3d' && (
          <WindowLevelHUD
            windowLevel={windowLevel}
            windowWidth={windowWidth}
            visible={isAdjustingWL}
          />
        )}

        {/* Slice Controls */}
        {!isEmpty && orientation && orientation !== '3d' && (
          <SliceControls
            currentSlice={currentSlice}
            totalSlices={totalSlices}
            onSliceChange={handleSliceChange}
          />
        )}
      </div>
    </div>
  );
}
