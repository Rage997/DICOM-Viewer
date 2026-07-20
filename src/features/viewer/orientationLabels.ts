/**
 * Anatomical orientation markers for 2D slice edges.
 *
 * Maps the volume's patient-space direction cosines (LPS: +X=Left, +Y=Posterior,
 * +Z=Superior) through the slice renderer's voxel→screen mapping to the anatomy
 * at each viewport edge. Assumes axis-aligned volumes (the VolumeBuilder guard);
 * for oblique series the dominant-axis label is approximate.
 *
 * Per-plane screen axes (from SliceRenderer.getVoxelIndex):
 *  - axial:    screen-x = +row (X voxel), screen-y↓ = +column (Y voxel)
 *  - sagittal: screen-x = +column (Y voxel), screen-y↓ = −slice (Z voxel)
 *  - coronal:  screen-x = +row (X voxel), screen-y↓ = −slice (Z voxel)
 */

import type { SliceOrientation, Volume } from '@/types';

export type AnatomyLabel = 'L' | 'R' | 'A' | 'P' | 'S' | 'I';

export interface EdgeLabels {
  top: AnatomyLabel;
  bottom: AnatomyLabel;
  left: AnatomyLabel;
  right: AnatomyLabel;
}

type Vec3 = readonly [number, number, number];

/** Dominant signed patient axis of a direction vector → LPS anatomy letter. */
export function anatomyDirection(v: Vec3): AnatomyLabel {
  const ax = Math.abs(v[0]);
  const ay = Math.abs(v[1]);
  const az = Math.abs(v[2]);
  if (ax >= ay && ax >= az) return v[0] >= 0 ? 'L' : 'R';
  if (ay >= az) return v[1] >= 0 ? 'P' : 'A';
  return v[2] >= 0 ? 'S' : 'I';
}

const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]];

/** Anatomy labels for the four screen edges of a slice plane. */
export function edgeLabels(orientation: Volume['orientation'], plane: SliceOrientation): EdgeLabels {
  const { row, column, slice } = orientation;
  switch (plane) {
    case 'axial':
      return {
        right: anatomyDirection(row),
        left: anatomyDirection(neg(row)),
        bottom: anatomyDirection(column),
        top: anatomyDirection(neg(column)),
      };
    case 'sagittal':
      return {
        right: anatomyDirection(column),
        left: anatomyDirection(neg(column)),
        top: anatomyDirection(slice),
        bottom: anatomyDirection(neg(slice)),
      };
    case 'coronal':
      return {
        right: anatomyDirection(row),
        left: anatomyDirection(neg(row)),
        top: anatomyDirection(slice),
        bottom: anatomyDirection(neg(slice)),
      };
  }
}
