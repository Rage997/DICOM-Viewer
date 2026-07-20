import { describe, it, expect } from 'vitest';
import { anatomyDirection, edgeLabels } from './orientationLabels';

const IDENTITY = {
  row: [1, 0, 0] as [number, number, number], // +X = Left
  column: [0, 1, 0] as [number, number, number], // +Y = Posterior
  slice: [0, 0, 1] as [number, number, number], // +Z = Superior
};

describe('anatomyDirection (LPS)', () => {
  it('maps signed dominant axis to the anatomy letter', () => {
    expect(anatomyDirection([1, 0, 0])).toBe('L');
    expect(anatomyDirection([-1, 0, 0])).toBe('R');
    expect(anatomyDirection([0, 1, 0])).toBe('P');
    expect(anatomyDirection([0, -1, 0])).toBe('A');
    expect(anatomyDirection([0, 0, 1])).toBe('S');
    expect(anatomyDirection([0, 0, -1])).toBe('I');
  });

  it('picks the dominant component for near-axis vectors', () => {
    expect(anatomyDirection([0.98, 0.1, 0.05])).toBe('L');
    expect(anatomyDirection([0.05, -0.99, 0.02])).toBe('A');
  });
});

describe('edgeLabels — standard radiological convention (identity orientation)', () => {
  it('axial: R|L across, A|P down (patient-left on image-right)', () => {
    expect(edgeLabels(IDENTITY, 'axial')).toEqual({ left: 'R', right: 'L', top: 'A', bottom: 'P' });
  });

  it('sagittal: A|P across, S|I down', () => {
    expect(edgeLabels(IDENTITY, 'sagittal')).toEqual({ left: 'A', right: 'P', top: 'S', bottom: 'I' });
  });

  it('coronal: R|L across, S|I down', () => {
    expect(edgeLabels(IDENTITY, 'coronal')).toEqual({ left: 'R', right: 'L', top: 'S', bottom: 'I' });
  });
});

describe('edgeLabels — flipped acquisition', () => {
  it('a reversed row axis swaps L/R on axial', () => {
    const flipped = { ...IDENTITY, row: [-1, 0, 0] as [number, number, number] };
    const labels = edgeLabels(flipped, 'axial');
    expect(labels.left).toBe('L');
    expect(labels.right).toBe('R');
  });
});
