import { describe, it, expect } from 'vitest';
import type { Volume, Measurement } from '@/types';
import { inPlaneSpacing, distanceMm, angleDeg, roiStats, voxelValueAt, measurementsForSlice, measurementResult, screenToVoxel, voxelToScreen, zoomAbout } from './measurements';

// 4×4×4 volume; anisotropic spacing so axis mix-ups are caught.
// data[i] = i, so for axial slice z: value(col,row) = z*16 + row*4 + col.
function makeVolume(): Volume {
  const data = new Int16Array(4 * 4 * 4);
  for (let i = 0; i < data.length; i++) data[i] = i;
  return {
    seriesInstanceUID: 'test',
    modality: 'CT',
    dimensions: { x: 4, y: 4, z: 4 },
    spacing: { x: 1, y: 2, z: 3 },
    origin: [0, 0, 0],
    orientation: { row: [1, 0, 0], column: [0, 1, 0], slice: [0, 0, 1] },
    data,
    dataRange: { min: 0, max: 63 },
    rescaleSlope: 1,
    rescaleIntercept: 0,
    windowLevel: 30,
    windowWidth: 60,
  };
}

describe('measurement geometry', () => {
  const volume = makeVolume();

  it('maps in-plane spacing per orientation', () => {
    expect(inPlaneSpacing(volume, 'axial')).toEqual({ sx: 1, sy: 2 });
    expect(inPlaneSpacing(volume, 'sagittal')).toEqual({ sx: 2, sy: 3 });
    expect(inPlaneSpacing(volume, 'coronal')).toEqual({ sx: 1, sy: 3 });
  });

  it('computes distance in mm using per-axis spacing', () => {
    const sp = inPlaneSpacing(volume, 'axial');
    // horizontal 3 voxels × 1mm
    expect(distanceMm({ x: 0, y: 0 }, { x: 3, y: 0 }, sp)).toBeCloseTo(3);
    // vertical 1 voxel × 2mm
    expect(distanceMm({ x: 0, y: 0 }, { x: 0, y: 1 }, sp)).toBeCloseTo(2);
    // 3-4-5 in mm: dx=3voxel*1=3, dy=2voxel*2=4 → 5
    expect(distanceMm({ x: 0, y: 0 }, { x: 3, y: 2 }, sp)).toBeCloseTo(5);
  });

  it('computes angle in degrees at the vertex, in mm space', () => {
    const sp = inPlaneSpacing(volume, 'axial');
    // rays (1,0)mm and (0,2)mm from vertex → 90°
    expect(angleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, sp)).toBeCloseTo(90);
    // straight line → 180°
    expect(angleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, sp)).toBeCloseTo(180);
  });

  it('reads rescaled voxel values on the axial slice', () => {
    // slice z=1: value(col,row) = 16 + row*4 + col
    expect(voxelValueAt(volume, 'axial', 1, 0, 0)).toBe(16);
    expect(voxelValueAt(volume, 'axial', 1, 2, 1)).toBe(16 + 4 + 2);
    // out of range → NaN
    expect(voxelValueAt(volume, 'axial', 1, 99, 0)).toBeNaN();
  });

  it('applies rescale slope/intercept to voxel values', () => {
    const scaled: Volume = { ...volume, rescaleSlope: 2, rescaleIntercept: -10 };
    // raw value at axial z=0 (0,0) = 0 → 0*2-10 = -10
    expect(voxelValueAt(scaled, 'axial', 0, 0, 0)).toBe(-10);
    // raw at (1,0) = 1 → 1*2-10 = -8
    expect(voxelValueAt(scaled, 'axial', 0, 1, 0)).toBe(-8);
  });

  it('computes ROI area and intensity statistics', () => {
    // axial slice 0, rect corners (0,0)-(1,1) → voxels (0,0)=0,(1,0)=1,(0,1)=4,(1,1)=5
    const stats = roiStats(volume, 'axial', 0, { x: 0, y: 0 }, { x: 1, y: 1 });
    expect(stats.count).toBe(4);
    expect(stats.mean).toBeCloseTo(2.5); // (0+1+4+5)/4
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(5);
    // area = |1 voxel * 1mm| * |1 voxel * 2mm| = 2 mm²
    expect(stats.areaMm2).toBeCloseTo(2);
  });

  it('clamps ROI bounds to the slice extent', () => {
    // corners beyond the slice still only sample valid voxels
    const stats = roiStats(volume, 'axial', 0, { x: -5, y: -5 }, { x: 99, y: 99 });
    expect(stats.count).toBe(16); // whole 4×4 axial slice
  });
});

describe('measurementsForSlice', () => {
  const m = (
    id: string,
    seriesInstanceUID: string,
    orientation: 'axial' | 'sagittal' | 'coronal',
    sliceIndex: number
  ): Measurement => ({ id, seriesInstanceUID, tool: 'distance', orientation, sliceIndex, points: [] });

  const all: Measurement[] = [
    m('a', 'series-1', 'axial', 5),
    m('b', 'series-1', 'axial', 6), // other slice
    m('c', 'series-1', 'sagittal', 5), // other orientation
    m('d', 'series-2', 'axial', 5), // other series, same slice+orientation
  ];

  it('returns only measurements matching series + orientation + slice', () => {
    const hit = measurementsForSlice(all, {
      seriesInstanceUID: 'series-1',
      orientation: 'axial',
      sliceIndex: 5,
    });
    expect(hit.map((x) => x.id)).toEqual(['a']);
  });

  it('never bleeds across series even when slice + orientation match', () => {
    const hit = measurementsForSlice(all, {
      seriesInstanceUID: 'series-2',
      orientation: 'axial',
      sliceIndex: 5,
    });
    expect(hit.map((x) => x.id)).toEqual(['d']);
  });
});

describe('measurementResult', () => {
  const volume = makeVolume(); // 4×4×4, spacing x:1 y:2 z:3, CT
  const base = { id: 'm', seriesInstanceUID: 's', sliceIndex: 0 };

  it('distance: value in mm + label', () => {
    const r = measurementResult(
      { ...base, tool: 'distance', orientation: 'axial', points: [{ x: 0, y: 0 }, { x: 3, y: 2 }] },
      volume
    );
    expect(r.distanceMm).toBeCloseTo(5); // dx=3*1, dy=2*2=4 → 5mm
    expect(r.valueUnit).toBe('mm');
    expect(r.label).toBe('5.0 mm');
  });

  it('angle: value in degrees + label', () => {
    const r = measurementResult(
      { ...base, tool: 'angle', orientation: 'axial', points: [{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }] },
      volume
    );
    expect(r.angleDeg).toBeCloseTo(90);
    expect(r.label).toBe('90.0°');
  });

  it('roi: area + intensity stats, HU unit for CT', () => {
    const r = measurementResult(
      { ...base, tool: 'roi', orientation: 'axial', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      volume
    );
    expect(r.areaMm2).toBeCloseTo(2); // 1*1mm × 1*2mm
    expect(r.count).toBe(4);
    expect(r.mean).toBeCloseTo(2.5);
    expect(r.intensityUnit).toBe('HU');
    expect(r.label).toContain('mm²');
    expect(r.label).toContain('HU');
  });

  it('non-CT modality drops the HU unit', () => {
    const r = measurementResult(
      { ...base, tool: 'roi', orientation: 'axial', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      { ...volume, modality: 'MR' }
    );
    expect(r.intensityUnit).toBe('');
    expect(r.label).not.toContain('HU');
  });
});

describe('screenToVoxel', () => {
  // 100×100 display, 50×50 slice → uniform scale 2, no letterbox offset.
  const rect = { left: 0, top: 0, width: 100, height: 100 };

  it('inverts the fit: screen center → slice center', () => {
    const p = screenToVoxel(50, 50, rect, 50, 50);
    expect(p.x).toBeCloseTo(25);
    expect(p.y).toBeCloseTo(25);
  });

  it('accounts for the letterbox offset on a non-matching aspect', () => {
    // 200 wide × 100 tall display, 50×50 slice → scale 2, letterbox x-offset 50.
    const wide = { left: 0, top: 0, width: 200, height: 100 };
    const p = screenToVoxel(100, 50, wide, 50, 50); // display center
    expect(p.x).toBeCloseTo(25); // maps to slice center despite the bars
    expect(p.y).toBeCloseTo(25);
  });

  it('subtracts the rect origin', () => {
    const p = screenToVoxel(60, 70, { left: 10, top: 20, width: 100, height: 100 }, 50, 50);
    expect(p.x).toBeCloseTo(25);
    expect(p.y).toBeCloseTo(25);
  });
});

describe('view transform (zoom/pan)', () => {
  const rect = { left: 0, top: 0, width: 100, height: 100 };

  it('screenToVoxel and voxelToScreen round-trip under identity', () => {
    const p = { x: 12, y: 37 };
    const scr = voxelToScreen(p, rect, 50, 50);
    const back = screenToVoxel(scr.x, scr.y, rect, 50, 50);
    expect(back.x).toBeCloseTo(12);
    expect(back.y).toBeCloseTo(37);
  });

  it('zoom scales around the fit; 2× doubles the pixels-per-voxel', () => {
    const a = voxelToScreen({ x: 0, y: 0 }, rect, 50, 50, { zoom: 2, panX: 0, panY: 0 });
    const b = voxelToScreen({ x: 1, y: 0 }, rect, 50, 50, { zoom: 2, panX: 0, panY: 0 });
    expect(b.x - a.x).toBeCloseTo(4); // identity scale 2 × zoom 2
  });

  it('pan shifts the screen position by the pan offset', () => {
    const base = voxelToScreen({ x: 25, y: 25 }, rect, 50, 50);
    const panned = voxelToScreen({ x: 25, y: 25 }, rect, 50, 50, { zoom: 1, panX: 30, panY: -10 });
    expect(panned.x - base.x).toBeCloseTo(30);
    expect(panned.y - base.y).toBeCloseTo(-10);
  });

  it('round-trips under zoom + pan', () => {
    const view = { zoom: 3, panX: 17, panY: -22 };
    const p = { x: 8, y: 44 };
    const scr = voxelToScreen(p, rect, 50, 50, view);
    const back = screenToVoxel(scr.x, scr.y, rect, 50, 50, view);
    expect(back.x).toBeCloseTo(8);
    expect(back.y).toBeCloseTo(44);
  });
});

describe('zoomAbout', () => {
  const rect = { left: 0, top: 0, width: 100, height: 100 };
  const identity = { zoom: 1, panX: 0, panY: 0 };

  it('keeps the anchor point pinned to the same voxel', () => {
    // Voxel under (70,30) before zoom must stay under (70,30) after.
    const before = screenToVoxel(70, 30, rect, 50, 50, identity);
    const zoomed = zoomAbout(identity, rect, 50, 50, 2, 70, 30);
    const after = screenToVoxel(70, 30, rect, 50, 50, zoomed);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(zoomed.zoom).toBeCloseTo(2);
  });

  it('clamps at min zoom 1 and recenters', () => {
    expect(zoomAbout(identity, rect, 50, 50, 0.5, 50, 50)).toEqual(identity);
  });

  it('clamps at max zoom 8', () => {
    const z = zoomAbout({ zoom: 8, panX: 0, panY: 0 }, rect, 50, 50, 2, 50, 50);
    expect(z.zoom).toBe(8);
  });
});
