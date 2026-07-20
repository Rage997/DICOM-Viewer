import { describe, it, expect, beforeEach } from 'vitest';
import { SliceRenderer } from './SliceRenderer';
import type { Volume } from '@/types';

function createMockVolume(): Volume {
  const dim = { x: 8, y: 8, z: 4 };
  const data = new Int16Array(dim.x * dim.y * dim.z);
  for (let i = 0; i < data.length; i++) {
    data[i] = i;
  }
  return {
    seriesInstanceUID: '1.2.3',
    modality: 'CT',
    dimensions: dim,
    spacing: { x: 1, y: 1, z: 3 },
    origin: [0, 0, 0],
    orientation: {
      row: [1, 0, 0],
      column: [0, 1, 0],
      slice: [0, 0, 1],
    },
    data,
    dataRange: { min: 0, max: dim.x * dim.y * dim.z - 1 },
    rescaleSlope: 1,
    rescaleIntercept: 0,
    windowLevel: 128,
    windowWidth: 256,
  };
}

describe('SliceRenderer', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 256 });
    Object.defineProperty(canvas, 'clientHeight', { value: 256 });
  });

  it('should create axial slice renderer', () => {
    const renderer = new SliceRenderer(canvas, 'axial');
    expect(renderer.getMaxIndex()).toBe(0); // no volume yet
    renderer.dispose();
  });

  it('should set volume and auto-center slice', () => {
    const renderer = new SliceRenderer(canvas, 'axial');
    const volume = createMockVolume();
    renderer.setVolume(volume);
    expect(renderer.getMaxIndex()).toBe(4);
    expect(renderer.getSliceIndex()).toBe(2); // floor(4/2)
    renderer.dispose();
  });

  it('should report correct max index per orientation', () => {
    const volume = createMockVolume();

    const axial = new SliceRenderer(canvas, 'axial');
    axial.setVolume(volume);
    expect(axial.getMaxIndex()).toBe(4); // z
    axial.dispose();

    const sagittal = new SliceRenderer(canvas, 'sagittal');
    sagittal.setVolume(volume);
    expect(sagittal.getMaxIndex()).toBe(8); // x
    sagittal.dispose();

    const coronal = new SliceRenderer(canvas, 'coronal');
    coronal.setVolume(volume);
    expect(coronal.getMaxIndex()).toBe(8); // y
    coronal.dispose();
  });

  it('should clamp slice index to valid range', () => {
    const renderer = new SliceRenderer(canvas, 'axial');
    const volume = createMockVolume();
    renderer.setVolume(volume);

    renderer.setSliceIndex(-5);
    expect(renderer.getSliceIndex()).toBe(0);

    renderer.setSliceIndex(100);
    expect(renderer.getSliceIndex()).toBe(3); // maxIndex - 1
    renderer.dispose();
  });

  it('should update window level', () => {
    const renderer = new SliceRenderer(canvas, 'axial');
    const volume = createMockVolume();
    renderer.setVolume(volume);
    // Should not throw
    expect(() => renderer.setWindowLevel(200, 500)).not.toThrow();
    renderer.dispose();
  });

  it('should render without throwing when volume is set', () => {
    const renderer = new SliceRenderer(canvas, 'axial');
    const volume = createMockVolume();
    renderer.setVolume(volume);
    expect(() => renderer.render()).not.toThrow();
    renderer.dispose();
  });

  it('should not throw render when no volume', () => {
    const renderer = new SliceRenderer(canvas, 'axial');
    expect(() => renderer.render()).not.toThrow();
    renderer.dispose();
  });
});
