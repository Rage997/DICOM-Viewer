/**
 * 3D Viewer type definitions
 */

import type * as THREE from 'three';
import type { SliceOrientation } from './dicom';

/**
 * Rendering backend type
 */
export type RenderingBackend = 'webgpu' | 'webgl2' | 'webgl';

/**
 * Rendering mode for volume visualization
 */
export type RenderMode =
  | 'volume' // Ray marching volume rendering
  | 'mip'    // Maximum Intensity Projection
  | 'minip'  // Minimum Intensity Projection
  | 'slice'; // Single slice view

/**
 * Viewport grid layout modes.
 */
export type LayoutMode =
  | 'single'         // 1×1 — one primary pane
  | 'quad'           // 2×2 — axial, sagittal, coronal, 3D
  | 'one-plus-three' // 1 large primary + 3 stacked secondaries
  | 'compare';       // 2-up side-by-side comparison of two series

/**
 * An orientation a viewport can show: a slice plane or the 3D volume.
 */
export type ViewportOrientation = SliceOrientation | '3d';

/**
 * All viewport orientations, in canonical display order.
 */
export const VIEWPORT_ORIENTATIONS: readonly ViewportOrientation[] = [
  'axial',
  'sagittal',
  'coronal',
  '3d',
];

/**
 * Measurement tools available on 2D slices.
 */
export type MeasurementTool = 'distance' | 'angle' | 'roi';

/**
 * A point in slice-plane voxel coordinates (col, row). Fractional allowed.
 */
export interface MeasurementPoint {
  x: number;
  y: number;
}

/**
 * A measurement pinned to a specific series + slice. `points` are in voxel
 * coordinates so they stay anchored to anatomy across resize/zoom/layout
 * changes:
 *  - distance: 2 endpoints
 *  - angle: 3 points (index 1 is the vertex)
 *  - roi: 2 opposite rectangle corners
 *
 * `seriesInstanceUID` scopes the measurement to one volume so it never bleeds
 * across series (series switch, compare mode).
 */
export interface Measurement {
  id: string;
  seriesInstanceUID: string;
  tool: MeasurementTool;
  orientation: SliceOrientation;
  sliceIndex: number;
  points: MeasurementPoint[];
  /** Optional user-given name shown in the measurements panel. */
  label?: string;
}

/**
 * Camera state
 */
export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  fov: number;
  zoom: number;
}

/**
 * Camera preset for quick navigation
 */
export interface CameraPreset {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  description?: string;
}

/**
 * Standard camera presets
 */
export const CAMERA_PRESETS: Record<string, CameraPreset> = {
  anterior: {
    name: 'Anterior',
    position: [0, 0, 300],
    target: [0, 0, 0],
    up: [0, 1, 0],
    description: 'Front view',
  },
  posterior: {
    name: 'Posterior',
    position: [0, 0, -300],
    target: [0, 0, 0],
    up: [0, 1, 0],
    description: 'Back view',
  },
  left: {
    name: 'Left',
    position: [-300, 0, 0],
    target: [0, 0, 0],
    up: [0, 1, 0],
    description: 'Left lateral view',
  },
  right: {
    name: 'Right',
    position: [300, 0, 0],
    target: [0, 0, 0],
    up: [0, 1, 0],
    description: 'Right lateral view',
  },
  superior: {
    name: 'Superior',
    position: [0, 300, 0],
    target: [0, 0, 0],
    up: [0, 0, -1],
    description: 'Top view',
  },
  inferior: {
    name: 'Inferior',
    position: [0, -300, 0],
    target: [0, 0, 0],
    up: [0, 0, 1],
    description: 'Bottom view',
  },
  isometric: {
    name: 'Isometric',
    position: [200, 200, 200],
    target: [0, 0, 0],
    up: [0, 1, 0],
    description: '3D isometric view',
  },
};

/**
 * Rendering settings
 */
export interface RenderSettings {
  // Window/Level (brightness/contrast)
  windowLevel: number;
  windowWidth: number;

  // Opacity and density
  opacity: number; // 0.0 to 1.0
  densityScale: number; // Multiplier for density sampling

  // Render quality
  stepSize: number; // Ray marching step size (smaller = better quality, slower)
  samples: number; // Number of samples per ray

  // Lighting (gradient-based shading)
  ambientLight: number; // 0.0 to 1.0
  diffuseLight: number; // 0.0 to 1.0
  specularLight: number; // 0.0 to 1.0
  shininess: number; // Specular exponent

  // Advanced features
  enableClipping: boolean;
  clippingPlanes: THREE.Plane[];
}

/**
 * Slice view state for MPR (Multi-Planar Reconstruction)
 */
export interface SliceViewState {
  orientation: SliceOrientation;
  index: number; // Current slice index
  maxIndex: number; // Total number of slices
  thickness: number; // Slice thickness in mm
  visible: boolean;
}

/**
 * Complete viewer state
 */
export interface ViewerState {
  // Rendering backend
  backend: RenderingBackend;

  // Camera
  camera: CameraState;

  // Render mode
  renderMode: RenderMode;

  // Render settings
  settings: RenderSettings;

  // Slice views (for MPR)
  sliceViews: {
    axial: SliceViewState;
    sagittal: SliceViewState;
    coronal: SliceViewState;
  };

  // Interaction state
  isInteracting: boolean;

  // Performance metrics
  fps: number;
  renderTime: number; // ms per frame
}

/**
 * Default render settings
 */
export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  windowLevel: 40,
  windowWidth: 400,
  opacity: 1.0,
  densityScale: 1.0,
  stepSize: 0.5,
  samples: 128,
  ambientLight: 0.2,
  diffuseLight: 0.8,
  specularLight: 0.3,
  shininess: 32,
  enableClipping: false,
  clippingPlanes: [],
};

/**
 * Default camera state
 */
export const DEFAULT_CAMERA_STATE: CameraState = {
  position: [200, 200, 200],
  target: [0, 0, 0],
  up: [0, 1, 0],
  fov: 45,
  zoom: 1.0,
};
