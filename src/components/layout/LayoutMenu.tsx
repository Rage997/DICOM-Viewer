/**
 * Layout dropdown: switch the viewport grid between 1×1, 2×2, and 1+3 arrangements.
 * Mirrors the Presets/Help dropdowns via the shared ToolbarMenu primitive.
 */

import { type ReactNode } from 'react';
import { Check } from 'lucide-react';
import type { LayoutMode } from '@/types';
import { ToolbarMenu } from './ToolbarMenu';

interface LayoutMenuProps {
  layout: LayoutMode;
  onChange?: (layout: LayoutMode) => void;
  disabled?: boolean;
  /** Compare needs ≥2 viewable series; disabled otherwise. */
  compareDisabled?: boolean;
}

// A filled sub-pane in a layout glyph. flex-1 divides evenly in a flex column;
// harmless (stretches to fill) as a grid item.
function Cell() {
  return <span className="flex-1 rounded-[1px] bg-current" />;
}

const GLYPHS: Record<LayoutMode, ReactNode> = {
  single: <span className="block h-4 w-4 rounded-[2px] bg-current" />,
  quad: (
    <span className="grid h-4 w-4 grid-cols-2 grid-rows-2 gap-[2px]">
      <Cell />
      <Cell />
      <Cell />
      <Cell />
    </span>
  ),
  'one-plus-three': (
    <span className="flex h-4 w-4 gap-[2px]">
      <span className="flex-[2] rounded-[1px] bg-current" />
      <span className="flex flex-1 flex-col gap-[2px]">
        <Cell />
        <Cell />
        <Cell />
      </span>
    </span>
  ),
  compare: (
    <span className="flex h-4 w-4 gap-[2px]">
      <span className="flex-1 rounded-[1px] bg-current" />
      <span className="flex-1 rounded-[1px] bg-current" />
    </span>
  ),
};

const ITEMS: { id: LayoutMode; label: string; hint: string }[] = [
  { id: 'single', label: 'Single', hint: '1×1' },
  { id: 'quad', label: 'Quad', hint: '2×2' },
  { id: 'one-plus-three', label: 'Primary + 3', hint: '1+3' },
  { id: 'compare', label: 'Compare', hint: '2-up' },
];

export function LayoutMenu({ layout, onChange, disabled, compareDisabled }: LayoutMenuProps) {
  return (
    <ToolbarMenu label="Layout" title="Viewport layout" disabled={disabled} width="w-52">
      {(close) =>
        ITEMS.map((item) => {
          const itemDisabled = item.id === 'compare' && compareDisabled;
          return (
            <button
              key={item.id}
              role="menuitem"
              disabled={itemDisabled}
              onClick={() => {
                onChange?.(item.id);
                close();
              }}
              title={itemDisabled ? 'Load a second series to compare' : undefined}
              className={`flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
                layout === item.id ? 'text-white' : 'text-neutral-300'
              }`}
            >
              <span className="text-neutral-400">{GLYPHS[item.id]}</span>
              <span className="flex-1 font-medium">{item.label}</span>
              {layout === item.id ? (
                <Check className="h-4 w-4 text-blue-400" />
              ) : (
                <span className="font-mono text-[10px] text-neutral-600">{item.hint}</span>
              )}
            </button>
          );
        })
      }
    </ToolbarMenu>
  );
}
