import { describe, it, expect } from 'vitest';
import { ORDERED_PRESETS, presetForDigit } from './presets';
import { CT_PRESETS } from '@/types';

describe('window/level presets', () => {
  it('exposes all six CT presets', () => {
    expect(ORDERED_PRESETS).toHaveLength(Object.keys(CT_PRESETS).length);
    expect(ORDERED_PRESETS).toHaveLength(6);
  });

  it('leads with the primary Brain/Lung/Bone set in order', () => {
    expect(ORDERED_PRESETS.slice(0, 3).map((p) => p.name)).toEqual([
      'Brain',
      'Lung',
      'Bone',
    ]);
  });

  it('binds digit key i+1 to preset at index i', () => {
    ORDERED_PRESETS.forEach((preset, i) => {
      expect(presetForDigit(String(i + 1))).toBe(preset);
    });
  });

  it('maps "1" to Brain with correct window/level values', () => {
    const brain = presetForDigit('1');
    expect(brain).toEqual(CT_PRESETS.brain);
    expect(brain?.windowLevel).toBe(40);
    expect(brain?.windowWidth).toBe(80);
  });

  it('returns null for digits beyond the preset count', () => {
    expect(presetForDigit('7')).toBeNull();
    expect(presetForDigit('9')).toBeNull();
  });

  it('returns null for "0" (no preset bound to zero)', () => {
    expect(presetForDigit('0')).toBeNull();
  });

  it('returns null for non-digit and multi-char keys', () => {
    expect(presetForDigit('a')).toBeNull();
    expect(presetForDigit('ArrowUp')).toBeNull();
    expect(presetForDigit('')).toBeNull();
    expect(presetForDigit('12')).toBeNull();
  });
});
