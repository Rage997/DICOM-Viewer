/**
 * VolumeRenderer wiring tests
 *
 * These assert the render *pipeline* the mock WebGL context can observe:
 *  - the volume mesh is assembled and added to the scene,
 *  - ray-march shader uniforms are wired from the render settings + volume, and
 *  - the camera position is transformed into model space for the shader.
 *
 * Pixel-truth ("not pure black", "different camera → different image") requires a
 * real GPU rasterizer and is covered by the Playwright e2e specs
 * (e2e/test-page-rendering.spec.ts, e2e/camera-stability.spec.ts). A JS-mocked
 * context has a no-op readPixels, so pixel assertions cannot run here.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { VolumeRenderer } from './VolumeRenderer';
import type { Volume } from '@/types';

// Helper to create a test volume with known data
function createTestVolume(): Volume {
  const dimensions = { x: 64, y: 64, z: 64 };
  const size = dimensions.x * dimensions.y * dimensions.z;
  const data = new Int16Array(size);

  // Fill with gradient pattern (0 to 255)
  // This creates a volume where density increases along each axis
  for (let z = 0; z < dimensions.z; z++) {
    for (let y = 0; y < dimensions.y; y++) {
      for (let x = 0; x < dimensions.x; x++) {
        const index = x + y * dimensions.x + z * dimensions.x * dimensions.y;
        // Create a sphere of higher density in the center
        const cx = dimensions.x / 2;
        const cy = dimensions.y / 2;
        const cz = dimensions.z / 2;
        const dx = x - cx;
        const dy = y - cy;
        const dz = z - cz;
        const distSq = dx * dx + dy * dy + dz * dz;
        const radius = 20;

        if (distSq < radius * radius) {
          data[index] = 200; // High density sphere
        } else {
          data[index] = 50; // Low density background
        }
      }
    }
  }

  return {
    seriesInstanceUID: 'test-series',
    modality: 'CT',
    dimensions,
    spacing: { x: 1, y: 1, z: 1 },
    origin: [0, 0, 0],
    orientation: {
      row: [1, 0, 0],
      column: [0, 1, 0],
      slice: [0, 0, 1],
    },
    data,
    dataRange: { min: 50, max: 200 },
    rescaleSlope: 1,
    rescaleIntercept: 0,
    windowLevel: 125,
    windowWidth: 150,
  };
}

const RENDER_SETTINGS = {
  windowLevel: 125,
  windowWidth: 150,
  opacity: 0.8,
  stepSize: 0.01,
  maxSteps: 256,
  renderMode: 'mip' as const,
  colorMap: 'hot' as const,
  clipEnabled: true,
  clipMin: [0.1, 0, 0] as [number, number, number],
  clipMax: [0.9, 1, 1] as [number, number, number],
};

// Find the volume mesh the renderer added to its scene, narrowing via instanceof
// so uniform/material access is compiler-checked (no unchecked casts).
function getVolumeMesh(renderer: VolumeRenderer): THREE.Mesh {
  const mesh = renderer
    .getScene()
    .children.find((child): child is THREE.Mesh => child instanceof THREE.Mesh);
  if (!mesh) {
    throw new Error('volume mesh was not added to the scene');
  }
  return mesh;
}

function getShaderMaterial(mesh: THREE.Mesh): THREE.ShaderMaterial {
  const material = mesh.material;
  if (!(material instanceof THREE.ShaderMaterial)) {
    throw new Error('volume mesh is not using a ShaderMaterial');
  }
  return material;
}

describe('VolumeRenderer - pipeline wiring', () => {
  let canvas: HTMLCanvasElement;
  let renderer: VolumeRenderer | null = null;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    document.body.appendChild(canvas);
  });

  afterEach(() => {
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
    if (canvas && canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
  });

  it('assembles the volume mesh and wires shader uniforms from settings', () => {
    renderer = new VolumeRenderer(canvas);
    renderer.loadVolume(createTestVolume(), RENDER_SETTINGS);

    const mesh = getVolumeMesh(renderer);
    const uniforms = getShaderMaterial(mesh).uniforms;

    // Render settings flow straight into the ray-march uniforms.
    expect(uniforms['windowLevel']?.value).toBe(125);
    expect(uniforms['windowWidth']?.value).toBe(150);
    expect(uniforms['opacity']?.value).toBe(0.8);
    expect(uniforms['stepSize']?.value).toBe(0.01);
    expect(uniforms['maxSteps']?.value).toBe(256);
    // Render mode / color map map to their shader uniform ids (mip=1, hot=1).
    expect(uniforms['renderMode']?.value).toBe(1);
    expect(uniforms['colorMap']?.value).toBe(1);
    // Clip box (enabled) → uniforms carry the bounds.
    expect(uniforms['clipMin']?.value.x).toBeCloseTo(0.1);
    expect(uniforms['clipMax']?.value.x).toBeCloseTo(0.9);

    // dataRange is rescaled by slope/intercept (1/0 here → unchanged).
    expect(uniforms['dataMin']?.value).toBe(50);
    expect(uniforms['dataMax']?.value).toBe(200);

    // Volume dimensions uniform mirrors the source volume.
    const dims = uniforms['volumeDimensions']?.value;
    expect(dims).toBeDefined();
    expect(dims.x).toBe(64);
    expect(dims.y).toBe(64);
    expect(dims.z).toBe(64);

    // Isotropic spacing → unit-cube mesh scale.
    expect(mesh.scale.x).toBeCloseTo(1);
    expect(mesh.scale.y).toBeCloseTo(1);
    expect(mesh.scale.z).toBeCloseTo(1);
  });

  it('feeds camera position into the ray-march uniform in model space', () => {
    renderer = new VolumeRenderer(canvas);

    // Anisotropic spacing so the model-space transform is a real per-axis
    // division, not an identity copy: physicalSize {64,64,128} → scale {.5,.5,1}.
    const volume: Volume = { ...createTestVolume(), spacing: { x: 1, y: 1, z: 2 } };

    // loadVolume runs exactly one synchronous render frame (RAF is stubbed, so the
    // loop does not recurse), and that frame calls updateCameraUniform() with the
    // camera's current position. Position the camera first, then load.
    renderer.getCamera().position.set(2, 2, 2);
    renderer.loadVolume(volume, RENDER_SETTINGS);

    const mesh = getVolumeMesh(renderer);
    expect(mesh.scale.x).toBeCloseTo(0.5);
    expect(mesh.scale.z).toBeCloseTo(1.0);

    // model-space position = world position / mesh scale.
    const camPos1 = getShaderMaterial(mesh).uniforms['uCameraPosition']?.value;
    expect(camPos1).toBeDefined();
    expect(camPos1.x).toBeCloseTo(4); // 2 / 0.5
    expect(camPos1.y).toBeCloseTo(4); // 2 / 0.5
    expect(camPos1.z).toBeCloseTo(2); // 2 / 1.0

    // A different camera position must produce a different uniform — this is what
    // makes the rendered frame change between viewpoints (verified for real in e2e).
    renderer.getCamera().position.set(-2, 2, 2);
    renderer.loadVolume(volume, RENDER_SETTINGS);

    const camPos2 = getShaderMaterial(getVolumeMesh(renderer)).uniforms['uCameraPosition']?.value;
    expect(camPos2).toBeDefined();
    expect(camPos2.x).toBeCloseTo(-4); // -2 / 0.5
    expect(camPos2.x).not.toBeCloseTo(camPos1.x);
  });
});
