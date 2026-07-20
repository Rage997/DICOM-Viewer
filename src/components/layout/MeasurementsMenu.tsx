/**
 * Measurements dropdown: pick a measurement tool (distance / angle / ROI) or clear.
 * Selecting a tool activates placement mode on the 2D slices (window/level drag is
 * suspended while active); the trigger label reflects the active tool.
 */

import { Check } from 'lucide-react';
import { useStore } from '@/state/store';
import { ToolbarMenu } from './ToolbarMenu';
import type { MeasurementTool } from '@/types';

const TOOLS: { id: MeasurementTool; label: string; hint: string }[] = [
  { id: 'distance', label: 'Distance', hint: 'mm' },
  { id: 'angle', label: 'Angle', hint: '°' },
  { id: 'roi', label: 'Rectangle ROI', hint: 'mm²' },
];

interface MeasurementsMenuProps {
  disabled?: boolean;
  listOpen?: boolean;
  onToggleList?: () => void;
}

export function MeasurementsMenu({ disabled, listOpen, onToggleList }: MeasurementsMenuProps) {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const measurements = useStore((s) => s.measurements);
  const clearMeasurements = useStore((s) => s.clearMeasurements);

  const activeLabel = TOOLS.find((t) => t.id === activeTool)?.label;
  const label = activeLabel ? `Measure: ${activeLabel}` : 'Measurements';

  return (
    <ToolbarMenu label={label} title="Measurement tools" disabled={disabled} width="w-60">
      {(close) => (
        <>
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              role="menuitem"
              onClick={() => {
                // Toggle: selecting the active tool again turns it off.
                setActiveTool(activeTool === tool.id ? null : tool.id);
                close();
              }}
              className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
            >
              <span className="flex-1 font-medium">{tool.label}</span>
              {activeTool === tool.id ? (
                <Check className="h-4 w-4 text-blue-400" />
              ) : (
                <span className="font-mono text-[10px] text-neutral-600">{tool.hint}</span>
              )}
            </button>
          ))}

          <div className="my-1 h-px bg-neutral-800" />

          <button
            role="menuitem"
            onClick={() => {
              onToggleList?.();
              close();
            }}
            className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            {listOpen ? 'Hide measurement list' : 'Show measurement list'}
          </button>

          <div className="my-1 h-px bg-neutral-800" />

          <button
            role="menuitem"
            disabled={measurements.length === 0}
            onClick={() => {
              clearMeasurements();
              close();
            }}
            className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear all{measurements.length > 0 ? ` (${measurements.length})` : ''}
          </button>
        </>
      )}
    </ToolbarMenu>
  );
}
