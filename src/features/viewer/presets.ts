/**
 * Window/Level preset ordering + keyboard mapping.
 *
 * Single source of truth shared by the Toolbar buttons and the App-level digit
 * key handler, so the on-screen order and the 1..N shortcuts never drift apart.
 */

import { CT_PRESETS, type WindowLevelPreset } from '@/types';

/**
 * Presets in display + shortcut order. Index i is bound to digit key `i + 1`.
 * Brain/Lung/Bone lead (the primary requested set), then the remaining CT presets.
 */
export const ORDERED_PRESETS: readonly WindowLevelPreset[] = [
  CT_PRESETS.brain,
  CT_PRESETS.lung,
  CT_PRESETS.bone,
  CT_PRESETS.abdomen,
  CT_PRESETS.liver,
  CT_PRESETS.spine,
];

/**
 * Map a keyboard digit ('1'..'9') to its preset, or null when the digit has no
 * preset bound. Only bare digits map — callers still filter out modifier combos.
 */
export function presetForDigit(key: string): WindowLevelPreset | null {
  if (key.length !== 1 || key < '1' || key > '9') return null;
  const index = Number(key) - 1;
  return ORDERED_PRESETS[index] ?? null;
}
