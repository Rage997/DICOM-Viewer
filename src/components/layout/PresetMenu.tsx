/**
 * Window/Level preset dropdown.
 *
 * Groups the CT presets behind a single toolbar trigger (like Layout) instead of
 * a row of buttons. Selecting a preset applies it and closes the menu; the row
 * matching the current window/level is marked. Digit shortcuts 1..6 (handled in
 * App) map to the same ORDERED_PRESETS order shown here.
 */

import { Check } from 'lucide-react';
import { ORDERED_PRESETS } from '@/features/viewer/presets';
import { ToolbarMenu } from './ToolbarMenu';

interface PresetMenuProps {
  onApplyPreset?: (windowLevel: number, windowWidth: number) => void;
  windowLevel?: number;
  windowWidth?: number;
  disabled?: boolean;
}

export function PresetMenu({ onApplyPreset, windowLevel, windowWidth, disabled }: PresetMenuProps) {
  return (
    <ToolbarMenu label="Presets" title="Window/Level presets (keys 1–6)" disabled={disabled} width="w-72">
      {(close) =>
        ORDERED_PRESETS.map((preset, i) => {
          const isActive =
            windowLevel !== undefined &&
            windowWidth !== undefined &&
            Math.round(windowLevel) === preset.windowLevel &&
            Math.round(windowWidth) === preset.windowWidth;

          return (
            <button
              key={preset.name}
              role="menuitem"
              onClick={() => {
                onApplyPreset?.(preset.windowLevel, preset.windowWidth);
                close();
              }}
              className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
            >
              <span className="w-4 text-center text-[10px] text-neutral-600">{i + 1}</span>
              <span className="flex-1">
                <span className="text-sm font-medium">{preset.name}</span>
                <span className="block text-xs text-neutral-500">{preset.description}</span>
              </span>
              {isActive ? (
                <Check className="h-4 w-4 text-blue-400" />
              ) : (
                <span className="font-mono text-[10px] text-neutral-600">
                  {preset.windowLevel}/{preset.windowWidth}
                </span>
              )}
            </button>
          );
        })
      }
    </ToolbarMenu>
  );
}
