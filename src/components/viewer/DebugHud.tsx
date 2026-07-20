/**
 * Dev-only performance HUD for the 3D renderer (FPS, frame time, draw calls,
 * memory). Rendered only under import.meta.env.DEV; toggle with Shift+D.
 */

import { useEffect, useState } from 'react';
import type { RendererStats } from '@/features/viewer/volume/VolumeRenderer';

interface DebugHudProps {
  getStats: () => RendererStats | null;
}

export function DebugHud({ getStats }: DebugHudProps) {
  const [stats, setStats] = useState<RendererStats | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = window.setInterval(() => setStats(getStats()), 250);
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'D' || e.key === 'd')) setVisible((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [getStats]);

  if (!visible || !stats) return null;

  const fpsColor =
    stats.fps >= 50 ? 'text-emerald-400' : stats.fps >= 25 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 rounded bg-black/70 px-2 py-1 font-mono text-[10px] leading-tight text-neutral-300 backdrop-blur-sm">
      <div className={fpsColor}>
        {stats.fps} fps · {stats.frameMs.toFixed(1)} ms
      </div>
      <div>
        {stats.drawCalls} draws · {stats.triangles.toLocaleString()} tris
      </div>
      <div>
        {stats.textures} tex · {stats.geometries} geo · {stats.maxSteps} steps
      </div>
      <div className="text-neutral-500">shift+D to hide</div>
    </div>
  );
}
