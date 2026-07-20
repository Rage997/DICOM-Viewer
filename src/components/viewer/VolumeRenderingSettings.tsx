/**
 * 3D volume rendering settings section (opacity, brightness, contrast, quality,
 * presets). Presentational: driven by props, rendered inside the Settings panel.
 * Ported from the old in-viewport VolumeControls panel.
 */

import { useMemo } from 'react';
import type {
  VolumeRenderSettings,
  VolumeRenderMode,
  VolumeColorMap,
} from '@/features/viewer/volume/VolumeRenderer';
import type { Volume } from '@/types';

interface VolumeRenderingSettingsProps {
  settings: VolumeRenderSettings;
  volume: Volume;
  onChange: (settings: Partial<VolumeRenderSettings>) => void;
}

const QUALITY_PRESETS = [
  { label: 'Standard', opacity: 0.8, stepSize: 0.005, maxSteps: 256 },
  { label: 'Transparent', opacity: 0.4, stepSize: 0.01, maxSteps: 128 },
  { label: 'Maximum Detail', opacity: 1.0, stepSize: 0.005, maxSteps: 256 },
];

const CLIP_AXES = [
  { label: 'X', axis: 0 },
  { label: 'Y', axis: 1 },
  { label: 'Z', axis: 2 },
] as const;

// Return a copy of a clip-bounds tuple with one axis replaced.
function withAxis(
  tuple: [number, number, number],
  axis: number,
  value: number
): [number, number, number] {
  const next: [number, number, number] = [tuple[0], tuple[1], tuple[2]];
  next[axis] = value;
  return next;
}

export function VolumeRenderingSettings({ settings, volume, onChange }: VolumeRenderingSettingsProps) {
  const dataRange = useMemo(() => {
    const { min, max } = volume.dataRange;
    const actualMin = min * volume.rescaleSlope + volume.rescaleIntercept;
    const actualMax = max * volume.rescaleSlope + volume.rescaleIntercept;
    return { min: actualMin, max: actualMax, span: actualMax - actualMin };
  }, [volume]);

  const brightnessPercent = Math.round(
    Math.max(0, Math.min(100, ((settings.windowLevel - dataRange.min) / dataRange.span) * 100))
  );
  const contrastPercent = Math.round(
    Math.max(0, Math.min(100, (1 - settings.windowWidth / dataRange.span) * 100))
  );

  const quality = settings.stepSize <= 0.005 ? 'High' : settings.stepSize <= 0.01 ? 'Medium' : 'Low';

  return (
    <div className="space-y-4 text-sm text-neutral-300">
      {/* Render mode */}
      <div>
        <label className="mb-1 block">Render Mode</label>
        <select
          value={settings.renderMode}
          onChange={(e) => onChange({ renderMode: e.target.value as VolumeRenderMode })}
          className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-300"
        >
          <option value="composite">Composite (shaded)</option>
          <option value="mip">MIP (max intensity)</option>
          <option value="minip">MinIP (min intensity)</option>
        </select>
      </div>

      {/* Color map */}
      <div>
        <label className="mb-1 block">Color Map</label>
        <select
          value={settings.colorMap}
          onChange={(e) => onChange({ colorMap: e.target.value as VolumeColorMap })}
          className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-300"
        >
          <option value="grayscale">Grayscale</option>
          <option value="hot">Hot Metal</option>
          <option value="pet">PET</option>
        </select>
      </div>
      {/* Opacity */}
      <div>
        <div className="mb-1 flex justify-between">
          <label>Opacity</label>
          <span className="text-neutral-500">{(settings.opacity * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(settings.opacity * 100)}
          onChange={(e) => onChange({ opacity: parseInt(e.target.value) / 100 })}
          className="w-full"
        />
      </div>

      {/* Brightness (window level) */}
      <div>
        <div className="mb-1 flex justify-between">
          <label>Brightness</label>
          <span className="text-neutral-500">{brightnessPercent}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={brightnessPercent}
          onChange={(e) =>
            onChange({ windowLevel: dataRange.min + (parseInt(e.target.value) / 100) * dataRange.span })
          }
          className="w-full"
        />
      </div>

      {/* Contrast (window width) */}
      <div>
        <div className="mb-1 flex justify-between">
          <label>Contrast</label>
          <span className="text-neutral-500">{contrastPercent}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={contrastPercent}
          onChange={(e) =>
            onChange({ windowWidth: Math.max(10, dataRange.span * (1 - parseInt(e.target.value) / 100)) })
          }
          className="w-full"
        />
      </div>

      {/* Quality */}
      <div>
        <div className="mb-1 flex justify-between">
          <label>Quality</label>
          <span className="text-neutral-500">{quality}</span>
        </div>
        <select
          value={settings.stepSize}
          onChange={(e) =>
            onChange({
              stepSize: parseFloat(e.target.value),
              maxSteps: parseFloat(e.target.value) <= 0.005 ? 256 : 128,
            })
          }
          className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-300"
        >
          <option value="0.02">Low (Fast)</option>
          <option value="0.01">Medium</option>
          <option value="0.005">High</option>
        </select>
      </div>

      {/* Presets */}
      <div>
        <label className="mb-1 block">Presets</label>
        <div className="flex flex-col gap-1">
          {QUALITY_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() =>
                onChange({ opacity: preset.opacity, stepSize: preset.stepSize, maxSteps: preset.maxSteps })
              }
              className="rounded bg-neutral-800 px-2 py-1 text-left text-neutral-300 transition-colors hover:bg-neutral-700"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clipping */}
      <div>
        <label className="mb-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.clipEnabled}
            onChange={(e) => onChange({ clipEnabled: e.target.checked })}
          />
          <span>Clipping</span>
        </label>
        <div className={settings.clipEnabled ? 'space-y-2' : 'space-y-2 pointer-events-none opacity-40'}>
          {CLIP_AXES.map(({ label, axis }) => (
            <div key={label}>
              <div className="mb-0.5 flex justify-between text-xs">
                <span>{label}</span>
                <span className="text-neutral-500">
                  {Math.round(settings.clipMin[axis] * 100)}–{Math.round(settings.clipMax[axis] * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(settings.clipMin[axis] * 100)}
                  onChange={(e) =>
                    onChange({ clipMin: withAxis(settings.clipMin, axis, parseInt(e.target.value) / 100) })
                  }
                  className="w-full"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(settings.clipMax[axis] * 100)}
                  onChange={(e) =>
                    onChange({ clipMax: withAxis(settings.clipMax, axis, parseInt(e.target.value) / 100) })
                  }
                  className="w-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
