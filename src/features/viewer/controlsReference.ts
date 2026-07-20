/**
 * Single source of truth for user-facing control descriptions.
 *
 * Rendered in three places, so it lives in one file to prevent drift:
 *  - the first-run "Mouse Controls" hint in the 3D view (3D group only),
 *  - the first-run "How to Navigate" modal (slice + preset groups),
 *  - the Help → Controls dialog (all groups).
 */

import { ORDERED_PRESETS } from './presets';

export interface ControlEntry {
  icon: string;
  input: string;
  effect: string;
}

export interface ControlGroup {
  id: 'view3d' | 'slices' | 'presets';
  title: string;
  entries: ControlEntry[];
}

export const CONTROL_GROUP_3D: ControlGroup = {
  id: 'view3d',
  title: '3D View',
  entries: [
    { icon: '🖱️', input: 'Left-drag', effect: 'Rotate the volume' },
    { icon: '✋', input: 'Right-drag', effect: 'Pan' },
    { icon: '🔍', input: 'Scroll', effect: 'Zoom in / out' },
  ],
};

export const CONTROL_GROUP_SLICES: ControlGroup = {
  id: 'slices',
  title: '2D Slices',
  entries: [
    { icon: '🖱️', input: 'Scroll', effect: 'Move through slices' },
    { icon: '✋', input: 'Left-drag', effect: 'Adjust brightness & contrast (Window/Level)' },
    { icon: '🎚️', input: 'Slider', effect: 'Jump to a specific slice' },
    { icon: '⌨️', input: '← →', effect: 'Previous / next slice (hovered view)' },
    { icon: '⌨️', input: '↑ ↓', effect: 'Adjust brightness (hovered view)' },
    { icon: '🔍', input: '⌘/Ctrl + Scroll', effect: 'Zoom in / out' },
    { icon: '✋', input: 'Middle-drag', effect: 'Pan (when zoomed)' },
    { icon: '⌨️', input: 'I', effect: 'Invert grayscale' },
  ],
};

export const CONTROL_GROUP_PRESETS: ControlGroup = {
  id: 'presets',
  title: 'Window/Level Presets',
  entries: [
    {
      icon: '🔢',
      input: `1–${ORDERED_PRESETS.length}`,
      effect: `Apply preset: ${ORDERED_PRESETS.map((p) => p.name).join(', ')}`,
    },
  ],
};

/** Every group, in the order shown by the full Controls dialog. */
export const ALL_CONTROL_GROUPS: readonly ControlGroup[] = [
  CONTROL_GROUP_3D,
  CONTROL_GROUP_SLICES,
  CONTROL_GROUP_PRESETS,
];
