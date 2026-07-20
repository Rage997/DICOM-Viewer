/**
 * Measurement geometry — pure functions mapping slice-plane voxel coordinates to
 * physical units using the volume's per-axis spacing. Shared by the overlay UI
 * and unit tests; no DOM or rendering here.
 */

import type { Volume, SliceOrientation } from '@/types';
import type { MeasurementPoint, Measurement } from '@/types';

export interface InPlaneSpacing {
  sx: number; // mm per voxel along the slice's horizontal (column) axis
  sy: number; // mm per voxel along the slice's vertical (row) axis
}

/** Slice dimensions in voxels for an orientation (mirrors the slice renderer). */
export function sliceDimensions(
  volume: Volume,
  orientation: SliceOrientation
): { width: number; height: number } {
  const { dimensions } = volume;
  switch (orientation) {
    case 'axial':
      return { width: dimensions.x, height: dimensions.y };
    case 'sagittal':
      return { width: dimensions.y, height: dimensions.z };
    case 'coronal':
      return { width: dimensions.x, height: dimensions.z };
  }
}

/** In-plane mm-per-voxel for an orientation's horizontal/vertical axes. */
export function inPlaneSpacing(volume: Volume, orientation: SliceOrientation): InPlaneSpacing {
  const { spacing } = volume;
  switch (orientation) {
    case 'axial':
      return { sx: spacing.x, sy: spacing.y };
    case 'sagittal':
      return { sx: spacing.y, sy: spacing.z };
    case 'coronal':
      return { sx: spacing.x, sy: spacing.z };
  }
}

/** Rescaled voxel value (e.g. HU) at a slice-plane (col,row), or NaN if out of range. */
export function voxelValueAt(
  volume: Volume,
  orientation: SliceOrientation,
  sliceIndex: number,
  col: number,
  row: number
): number {
  const { dimensions, data, rescaleSlope, rescaleIntercept } = volume;
  const { width, height } = sliceDimensions(volume, orientation);
  if (col < 0 || col >= width || row < 0 || row >= height) return NaN;

  const X = dimensions.x;
  const Y = dimensions.y;
  const Z = dimensions.z;

  let index: number;
  switch (orientation) {
    case 'axial':
      index = sliceIndex * X * Y + row * X + col;
      break;
    case 'sagittal': {
      const z = Z - 1 - row;
      index = z * X * Y + col * X + sliceIndex;
      break;
    }
    case 'coronal': {
      const z = Z - 1 - row;
      index = z * X * Y + sliceIndex * X + col;
      break;
    }
  }

  const raw = data[index] ?? 0;
  return raw * rescaleSlope + rescaleIntercept;
}

/** Euclidean distance in mm between two slice-plane points. */
export function distanceMm(a: MeasurementPoint, b: MeasurementPoint, spacing: InPlaneSpacing): number {
  const dx = (b.x - a.x) * spacing.sx;
  const dy = (b.y - a.y) * spacing.sy;
  return Math.hypot(dx, dy);
}

/** Angle in degrees (0–180) at `vertex` between rays to `a` and `b`, in mm space. */
export function angleDeg(
  a: MeasurementPoint,
  vertex: MeasurementPoint,
  b: MeasurementPoint,
  spacing: InPlaneSpacing
): number {
  const v1x = (a.x - vertex.x) * spacing.sx;
  const v1y = (a.y - vertex.y) * spacing.sy;
  const v2x = (b.x - vertex.x) * spacing.sx;
  const v2y = (b.y - vertex.y) * spacing.sy;
  const dot = v1x * v2x + v1y * v2y;
  const cross = v1x * v2y - v1y * v2x;
  return (Math.atan2(Math.abs(cross), dot) * 180) / Math.PI;
}

export interface RoiStats {
  areaMm2: number;
  mean: number;
  std: number;
  min: number;
  max: number;
  count: number;
}

/** Area (mm²) and intensity statistics for a rectangle defined by two opposite corners. */
export function roiStats(
  volume: Volume,
  orientation: SliceOrientation,
  sliceIndex: number,
  cornerA: MeasurementPoint,
  cornerB: MeasurementPoint
): RoiStats {
  const spacing = inPlaneSpacing(volume, orientation);
  const areaMm2 = Math.abs((cornerB.x - cornerA.x) * spacing.sx) * Math.abs((cornerB.y - cornerA.y) * spacing.sy);

  const { width, height } = sliceDimensions(volume, orientation);
  const minCol = Math.max(0, Math.floor(Math.min(cornerA.x, cornerB.x)));
  const maxCol = Math.min(width - 1, Math.ceil(Math.max(cornerA.x, cornerB.x)));
  const minRow = Math.max(0, Math.floor(Math.min(cornerA.y, cornerB.y)));
  const maxRow = Math.min(height - 1, Math.ceil(Math.max(cornerA.y, cornerB.y)));

  let count = 0;
  let sum = 0;
  let sumSq = 0;
  let min = Infinity;
  let max = -Infinity;

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const v = voxelValueAt(volume, orientation, sliceIndex, col, row);
      if (Number.isNaN(v)) continue;
      count++;
      sum += v;
      sumSq += v * v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  const mean = count > 0 ? sum / count : 0;
  const variance = count > 0 ? Math.max(0, sumSq / count - mean * mean) : 0;
  return {
    areaMm2,
    mean,
    std: Math.sqrt(variance),
    min: count > 0 ? min : 0,
    max: count > 0 ? max : 0,
    count,
  };
}

/** Measurements scoped to one series + slice — never bleeds across series. */
export function measurementsForSlice(
  measurements: Measurement[],
  scope: { seriesInstanceUID: string; orientation: SliceOrientation; sliceIndex: number }
): Measurement[] {
  return measurements.filter(
    (m) =>
      m.seriesInstanceUID === scope.seriesInstanceUID &&
      m.orientation === scope.orientation &&
      m.sliceIndex === scope.sliceIndex
  );
}

/** Structured value(s) + display label for a measurement, from its own volume. */
export interface MeasurementResult {
  tool: Measurement['tool'];
  label: string; // display string, e.g. "42.3 mm"
  valueUnit: string; // primary unit: 'mm' | '°' | 'mm²' | ''
  distanceMm?: number;
  angleDeg?: number;
  areaMm2?: number;
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  count?: number;
  intensityUnit?: string; // 'HU' for CT, '' otherwise
}

/**
 * Compute a measurement's physical value(s) and a display label, using the
 * measurement's own orientation + slice. Shared by the overlay, the
 * measurements panel, and numeric export so every surface agrees.
 */
export function measurementResult(m: Measurement, volume: Volume): MeasurementResult {
  const spacing = inPlaneSpacing(volume, m.orientation);
  const intensityUnit = volume.modality === 'CT' ? 'HU' : '';

  if (m.tool === 'distance' && m.points[0] && m.points[1]) {
    const d = distanceMm(m.points[0], m.points[1], spacing);
    return { tool: 'distance', valueUnit: 'mm', distanceMm: d, label: `${d.toFixed(1)} mm` };
  }
  if (m.tool === 'angle' && m.points[0] && m.points[1] && m.points[2]) {
    const a = angleDeg(m.points[0], m.points[1], m.points[2], spacing);
    return { tool: 'angle', valueUnit: '°', angleDeg: a, label: `${a.toFixed(1)}°` };
  }
  if (m.tool === 'roi' && m.points[0] && m.points[1]) {
    const s = roiStats(volume, m.orientation, m.sliceIndex, m.points[0], m.points[1]);
    const u = intensityUnit ? ` ${intensityUnit}` : '';
    return {
      tool: 'roi',
      valueUnit: 'mm²',
      areaMm2: s.areaMm2,
      mean: s.mean,
      std: s.std,
      min: s.min,
      max: s.max,
      count: s.count,
      intensityUnit,
      label: `${s.areaMm2.toFixed(0)} mm² · μ${s.mean.toFixed(0)}±${s.std.toFixed(0)}${u}`,
    };
  }
  return { tool: m.tool, valueUnit: '', label: '—' };
}

/** Pan/zoom applied on top of the letterbox fit. Identity = no transform. */
export interface ViewTransform {
  zoom: number;
  panX: number;
  panY: number;
}

export const IDENTITY_VIEW: ViewTransform = { zoom: 1, panX: 0, panY: 0 };

type Rect = { left: number; top: number; width: number; height: number };

// Effective scale + top-left origin of the drawn slice within the rect, after
// the letterbox fit and the pan/zoom view. Matches SliceRenderer's draw math.
function fit(rect: Rect, vw: number, vh: number, view: ViewTransform) {
  const s = Math.min(rect.width / vw, rect.height / vh) * view.zoom;
  return { s, ox: (rect.width - vw * s) / 2 + view.panX, oy: (rect.height - vh * s) / 2 + view.panY };
}

/**
 * Map a screen point (clientX/Y) to fractional slice voxel coordinates, given
 * the display rect, slice dimensions, and view transform. Inverts the letterbox
 * fit + pan/zoom used by the slice renderer. Shared by the overlay and probe.
 */
export function screenToVoxel(
  clientX: number,
  clientY: number,
  rect: Rect,
  vw: number,
  vh: number,
  view: ViewTransform = IDENTITY_VIEW
): MeasurementPoint {
  const { s, ox, oy } = fit(rect, vw, vh, view);
  return { x: (clientX - rect.left - ox) / s, y: (clientY - rect.top - oy) / s };
}

/** Map a fractional slice voxel point to a screen point within the rect. */
export function voxelToScreen(
  p: MeasurementPoint,
  rect: Rect,
  vw: number,
  vh: number,
  view: ViewTransform = IDENTITY_VIEW
): { x: number; y: number } {
  const { s, ox, oy } = fit(rect, vw, vh, view);
  return { x: ox + p.x * s, y: oy + p.y * s };
}

/**
 * New view after multiplying zoom by `factor` while keeping the rect-local point
 * (cx, cy) anchored to the same voxel. Clamps zoom to [1, 8]; zoom 1 recenters.
 * Shared by ⌘/Ctrl+wheel (cursor point) and the +/− buttons (rect center).
 */
export function zoomAbout(
  view: ViewTransform,
  rect: Rect,
  vw: number,
  vh: number,
  factor: number,
  cx: number,
  cy: number
): ViewTransform {
  const zoom = Math.max(1, Math.min(8, view.zoom * factor));
  if (zoom === 1) return IDENTITY_VIEW;
  const base = Math.min(rect.width / vw, rect.height / vh);
  const s0 = base * view.zoom;
  const s1 = base * zoom;
  const voxX = (cx - (rect.width - vw * s0) / 2 - view.panX) / s0;
  const voxY = (cy - (rect.height - vh * s0) / 2 - view.panY) / s0;
  return {
    zoom,
    panX: cx - (rect.width - vw * s1) / 2 - voxX * s1,
    panY: cy - (rect.height - vh * s1) / 2 - voxY * s1,
  };
}
