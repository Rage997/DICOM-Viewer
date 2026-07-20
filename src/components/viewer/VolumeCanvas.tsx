import { useEffect, useRef, useCallback } from 'react';
import { VolumeRenderer } from '@/features/viewer/volume/VolumeRenderer';
import { CameraController } from '@/features/viewer/controls/CameraControls';
import { VolumeNavigationControls } from './VolumeNavigationControls';
import { DebugHud } from './DebugHud';
import { useStore } from '@/state/store';
import { DEFAULT_VOLUME_SETTINGS } from '@/state/slices/settingsSlice';
import type { Volume } from '@/types';

interface VolumeCanvasProps {
  volume: Volume | null;
}

export function VolumeCanvas({ volume }: VolumeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<VolumeRenderer | null>(null);
  const controlsRef = useRef<CameraController | null>(null);
  const loadedVolumeRef = useRef<string | null>(null);

  // 3D render settings live in the store so the toolbar Settings panel can edit
  // them from outside the viewport tree.
  const volumeSettings = useStore((s) => s.volumeSettings);
  const seedVolumeSettings = useStore((s) => s.seedVolumeSettings);

  // Initialize renderer (once on mount)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = containerRef.current;
    if (!container) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    try {
      const renderer = new VolumeRenderer(canvas);
      rendererRef.current = renderer;

      controlsRef.current = new CameraController(renderer.getCamera(), canvas);

      // Drive OrbitControls damping from the renderer's single RAF loop.
      renderer.setBeforeRender(() => controlsRef.current?.update());
    } catch (error) {
      console.error('[VolumeCanvas] Failed to initialize:', error);
    }

    return () => {
      rendererRef.current?.setBeforeRender(null);
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
      loadedVolumeRef.current = null;
    };
  }, []);

  // Load volume when it changes (skips if same volume already loaded)
  useEffect(() => {
    const renderer = rendererRef.current;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !volume || !container || !canvas) return;

    // Skip if this exact volume is already loaded
    if (loadedVolumeRef.current === volume.seriesInstanceUID) return;
    loadedVolumeRef.current = volume.seriesInstanceUID;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width > 0 && height > 0) {
      canvas.width = width;
      canvas.height = height;
      renderer.resize(width, height);
    }

    let windowLevel: number;
    let windowWidth: number;

    if (volume.windowLevel !== undefined && volume.windowWidth !== undefined) {
      windowLevel = volume.windowLevel;
      windowWidth = volume.windowWidth;
    } else {
      const { min, max } = volume.dataRange;
      const actualMin = min * volume.rescaleSlope + volume.rescaleIntercept;
      const actualMax = max * volume.rescaleSlope + volume.rescaleIntercept;
      const range = actualMax - actualMin;
      windowLevel = actualMin + range / 2;
      windowWidth = range;
    }

    // Seed this volume's window/level the first time it loads (no-op on remount,
    // so Settings-panel edits survive layout changes), then render with the
    // current store settings.
    seedVolumeSettings(volume.seriesInstanceUID, { ...DEFAULT_VOLUME_SETTINGS, windowLevel, windowWidth });

    try {
      renderer.loadVolume(volume, useStore.getState().volumeSettings);
    } catch (error) {
      console.error('[VolumeCanvas] Failed to load volume:', error);
    }
  }, [volume, seedVolumeSettings]);

  // Apply live settings edits (from the Settings panel) to the renderer without
  // rebuilding the volume texture.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || loadedVolumeRef.current === null) return;
    renderer.updateSettings(volumeSettings);
  }, [volumeSettings]);

  // Handle camera reset
  const handleCameraReset = useCallback(() => {
    controlsRef.current?.resetToDefault();
  }, []);

  const handleZoomIn = useCallback(() => {
    controlsRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    controlsRef.current?.zoomOut();
  }, []);

  // Dev-only performance HUD stats source (stable identity).
  const getDebugStats = useCallback(() => rendererRef.current?.getStats() ?? null, []);

  // Handle anatomical view presets
  const handleSetView = useCallback(
    (view: 'anterior' | 'posterior' | 'left' | 'right' | 'superior' | 'inferior') => {
      const controls = controlsRef.current;
      if (!controls) return;

      switch (view) {
        case 'anterior':
          controls.setAnteriorView();
          break;
        case 'posterior':
          controls.setPosteriorView();
          break;
        case 'left':
          controls.setLeftLateralView();
          break;
        case 'right':
          controls.setRightLateralView();
          break;
        case 'superior':
          controls.setSuperiorView();
          break;
        case 'inferior':
          controls.setInferiorView();
          break;
      }
    },
    []
  );

  // Resize observer
  const handleResize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!container || !canvas || !renderer) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;
    renderer.resize(width, height);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [handleResize]);

  return (
    <div ref={containerRef} className="relative h-full w-full bg-black">
      <canvas ref={canvasRef} className="block h-full w-full" />
      {volume && (
        <VolumeNavigationControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleCameraReset}
          onSetView={handleSetView}
        />
      )}
      {import.meta.env.DEV && <DebugHud getStats={getDebugStats} />}
    </div>
  );
}
