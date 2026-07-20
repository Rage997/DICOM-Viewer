import { describe, it, expect } from 'vitest';
import type { Volume } from '@/types';
import { sliceCountFor, mapSliceProportional } from './compareSync';

function vol(x: number, y: number, z: number): Volume {
  return {
    seriesInstanceUID: 's',
    modality: 'MR',
    dimensions: { x, y, z },
    spacing: { x: 1, y: 1, z: 1 },
    origin: [0, 0, 0],
    orientation: { row: [1, 0, 0], column: [0, 1, 0], slice: [0, 0, 1] },
    data: new Int16Array(0),
    dataRange: { min: 0, max: 1 },
    rescaleSlope: 1,
    rescaleIntercept: 0,
  };
}

describe('sliceCountFor', () => {
  it('picks the through-plane axis per orientation', () => {
    const v = vol(256, 224, 20);
    expect(sliceCountFor(v, 'axial')).toBe(20); // z
    expect(sliceCountFor(v, 'sagittal')).toBe(256); // x
    expect(sliceCountFor(v, 'coronal')).toBe(224); // y
  });
});

describe('mapSliceProportional', () => {
  it('maps by fraction of the stack; endpoints and midpoint align', () => {
    // 20-slice left -> 100-slice right
    expect(mapSliceProportional(0, 20, 100)).toBe(0);
    expect(mapSliceProportional(19, 20, 100)).toBe(99);
    expect(mapSliceProportional(10, 21, 101)).toBe(50); // exact midpoints
  });

  it('is symmetric-ish and clamps within range', () => {
    // 100 -> 20: quarter depth
    expect(mapSliceProportional(25, 101, 21)).toBe(5); // 0.25 * 20 = 5
    expect(mapSliceProportional(200, 101, 21)).toBe(20); // clamped to last
  });

  it('returns 0 for degenerate single-slice stacks', () => {
    expect(mapSliceProportional(0, 1, 50)).toBe(0);
    expect(mapSliceProportional(5, 50, 1)).toBe(0);
  });
});
