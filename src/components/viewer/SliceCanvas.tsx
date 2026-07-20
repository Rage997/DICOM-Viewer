import { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from '@/state/store';
import { SliceRenderer } from '@/features/viewer/slice/SliceRenderer';
import { MeasurementOverlay } from './MeasurementOverlay';
import { sliceDimensions, voxelValueAt, screenToVoxel, zoomAbout } from '@/features/viewer/measurements';
import { edgeLabels } from '@/features/viewer/orientationLabels';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { Volume, SliceOrientation } from '@/types';

interface SliceCanvasProps {
  volume: Volume | null;
  orientation: SliceOrientation;
  windowLevel?: number;
  windowWidth?: number;
  sliceIndex?: number;
  onWindowLevelChange?: (level: number, width: number) => void;
  onSliceChange?: (slice: number) => void;
}

export function SliceCanvas({
  volume,
  orientation,
  windowLevel,
  windowWidth,
  sliceIndex,
  onWindowLevelChange,
  onSliceChange,
}: SliceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SliceRenderer | null>(null);

  const [isDraggingWL, setIsDraggingWL] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; level: number; width: number } | null>(null);
  // Live intensity probe: value + voxel coords under the cursor (null when off-slice).
  const [probe, setProbe] = useState<{ col: number; row: number; value: number } | null>(null);
  // 2D pan/zoom view (per-pane). Pan in CSS px; zoom multiplies the letterbox fit.
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const viewRef = useRef(view);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new SliceRenderer(canvas, orientation);
    rendererRef.current = renderer;

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [orientation]);

  // Load volume
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !volume) return;
    renderer.setVolume(volume);
  }, [volume]);

  // Update window/level
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || windowLevel === undefined || windowWidth === undefined) return;
    renderer.setWindowLevel(windowLevel, windowWidth);
  }, [windowLevel, windowWidth]);

  // Grayscale invert (global 2D setting).
  const invert2d = useStore((s) => s.invert2d);
  useEffect(() => {
    rendererRef.current?.setInvert(invert2d);
  }, [invert2d]);

  // Mirror the view into a ref so event handlers read it without re-binding.
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Push pan/zoom to the renderer.
  useEffect(() => {
    rendererRef.current?.setViewTransform(view.zoom, view.panX, view.panY);
  }, [view]);

  // Reset pan/zoom when the plane or volume changes.
  useEffect(() => {
    setView({ zoom: 1, panX: 0, panY: 0 });
  }, [volume, orientation]);

  // Update slice index - ALWAYS sync from parent
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || sliceIndex === undefined) return;
    renderer.setSliceIndex(sliceIndex);
  }, [sliceIndex]);

  // Zoom about a rect-local point (cursor for wheel, center for buttons).
  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const container = containerRef.current;
      if (!container || !volume) return;
      const rect = container.getBoundingClientRect();
      const { width: vw, height: vh } = sliceDimensions(volume, orientation);
      setView((prev) => zoomAbout(prev, rect, vw, vh, factor, cx, cy));
    },
    [volume, orientation]
  );

  const zoomAtCenter = useCallback(
    (factor: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) zoomAt(factor, rect.width / 2, rect.height / 2);
    },
    [zoomAt]
  );

  // Scroll = slice nav; ⌘/Ctrl+scroll = zoom about the cursor.
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
        return;
      }
      if (!onSliceChange || sliceIndex === undefined) return;
      onSliceChange(sliceIndex + (e.deltaY > 0 ? 1 : -1));
    },
    [onSliceChange, sliceIndex, zoomAt]
  );

  // Left-drag = window/level; middle-drag = pan.
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      const v = viewRef.current;
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: v.panX, panY: v.panY };
      setIsPanning(true);
      return;
    }
    if (e.button !== 0 || !onWindowLevelChange || windowLevel === undefined || windowWidth === undefined) return;

    e.preventDefault();
    setIsDraggingWL(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      level: windowLevel,
      width: windowWidth,
    };
  }, [windowLevel, windowWidth, onWindowLevelChange]);
  // Hover probe: map cursor → voxel and read the (rescaled) value at that voxel.
  const handleProbeMove = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (!container || !volume) return;
      const { width: vw, height: vh } = sliceDimensions(volume, orientation);
      const p = screenToVoxel(e.clientX, e.clientY, container.getBoundingClientRect(), vw, vh, viewRef.current);
      const col = Math.floor(p.x);
      const row = Math.floor(p.y);
      if (col < 0 || row < 0 || col >= vw || row >= vh) {
        setProbe(null);
        return;
      }
      setProbe({ col, row, value: voxelValueAt(volume, orientation, sliceIndex ?? 0, col, row) });
    },
    [volume, orientation, sliceIndex]
  );

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (panStartRef.current) {
      const start = panStartRef.current;
      setView((prev) => ({
        ...prev,
        panX: start.panX + (e.clientX - start.x),
        panY: start.panY + (e.clientY - start.y),
      }));
      return;
    }
    if (!isDraggingWL || !dragStartRef.current || !onWindowLevelChange) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    const newWidth = Math.max(1, dragStartRef.current.width + dx * 2);
    const newLevel = dragStartRef.current.level - dy;

    onWindowLevelChange(newLevel, newWidth);
  }, [isDraggingWL, onWindowLevelChange]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingWL(false);
    dragStartRef.current = null;
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  // Global mouse events while dragging (window/level) or panning.
  useEffect(() => {
    if (isDraggingWL || isPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isDraggingWL, isPanning, handleMouseMove, handleMouseUp]);

  // Resize observer
  const handleResize = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.resize();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [handleResize]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className={`block h-full w-full ${isPanning ? 'cursor-grabbing' : isDraggingWL ? 'cursor-move' : 'cursor-crosshair'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleProbeMove}
        onMouseLeave={() => setProbe(null)}
      />
      {volume && (
        <MeasurementOverlay
          volume={volume}
          orientation={orientation}
          sliceIndex={sliceIndex ?? 0}
          onSliceChange={onSliceChange}
          view={view}
        />
      )}
      {volume && (
        <div className="absolute bottom-12 right-2 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => zoomAtCenter(1.25)}
            className="rounded bg-black/70 p-1.5 text-white/80 hover:bg-black/90 hover:text-white"
            title="Zoom in (⌘/Ctrl + scroll)"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => zoomAtCenter(1 / 1.25)}
            className="rounded bg-black/70 p-1.5 text-white/80 hover:bg-black/90 hover:text-white"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          {(view.zoom !== 1 || view.panX !== 0 || view.panY !== 0) && (
            <button
              type="button"
              onClick={() => setView({ zoom: 1, panX: 0, panY: 0 })}
              className="rounded bg-black/70 p-1.5 text-white/80 hover:bg-black/90 hover:text-white"
              title="Reset zoom & pan"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {volume && (() => {
        const e = edgeLabels(volume.orientation, orientation);
        const cls =
          'pointer-events-none absolute font-semibold text-[11px] text-amber-300/80 select-none';
        return (
          <>
            <span className={`${cls} top-1 left-1/2 -translate-x-1/2`}>{e.top}</span>
            <span className={`${cls} bottom-10 left-1/2 -translate-x-1/2`}>{e.bottom}</span>
            <span className={`${cls} left-1 top-1/2 -translate-y-1/2`}>{e.left}</span>
            <span className={`${cls} right-1 top-1/2 -translate-y-1/2`}>{e.right}</span>
          </>
        );
      })()}
      {probe && volume && (
        <div className="pointer-events-none absolute right-2 top-2 rounded border border-white/15 bg-black/80 px-2 py-1 font-mono text-xs text-white/90">
          ({probe.col}, {probe.row}) ·{' '}
          {Number.isNaN(probe.value) ? '—' : Math.round(probe.value)}
          {volume.modality === 'CT' ? ' HU' : ''}
        </div>
      )}
    </div>
  );
}
