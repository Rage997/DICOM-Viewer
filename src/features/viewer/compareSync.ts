/**
 * Compare-mode slice math — pure helpers for mapping slice positions between two
 * volumes of differing geometry. Shared by CompareView; unit-tested.
 */

import type { SliceOrientation, Volume } from '@/types';

/** Number of slices along an orientation's through-plane axis. */
export function sliceCountFor(volume: Volume, orientation: SliceOrientation): number {
  return orientation === 'axial'
    ? volume.dimensions.z
    : orientation === 'sagittal'
      ? volume.dimensions.x
      : volume.dimensions.y;
}

/**
 * Map a slice index from one stack to the proportional position in another:
 * index/(fromTotal-1) fraction → round onto (toTotal-1). Robust for any two
 * stack sizes; endpoints map to endpoints, midpoint to midpoint.
 */
export function mapSliceProportional(index: number, fromTotal: number, toTotal: number): number {
  if (toTotal <= 1 || fromTotal <= 1) return 0;
  const frac = index / (fromTotal - 1);
  return Math.max(0, Math.min(toTotal - 1, Math.round(frac * (toTotal - 1))));
}
