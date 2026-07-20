import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { Volume } from '@/types';
import { VolumeTextureBuilder } from './VolumeTexture';

// Three.js WebGLRenderer requires a full GL context that's impractical to mock.
// Test the VolumeTexture and render logic components separately.

function createMockVolume(): Volume {
  const data = new Int16Array(4 * 4 * 4);
  for (let i = 0; i < data.length; i++) {
    data[i] = i * 10;
  }
  return {
    seriesInstanceUID: '1.2.3.4.5',
    modality: 'CT',
    dimensions: { x: 4, y: 4, z: 4 },
    spacing: { x: 1, y: 1, z: 2 },
    origin: [0, 0, 0],
    orientation: {
      row: [1, 0, 0],
      column: [0, 1, 0],
      slice: [0, 0, 1],
    },
    data,
    dataRange: { min: 0, max: 630 },
    rescaleSlope: 1,
    rescaleIntercept: -1024,
    windowLevel: 40,
    windowWidth: 400,
  };
}

describe('VolumeTextureBuilder', () => {
  it('should build texture from volume', () => {
    const volume = createMockVolume();
    const texture = VolumeTextureBuilder.buildTexture(volume);
    expect(texture).toBeInstanceOf(THREE.Data3DTexture);
    expect(texture.image.width).toBe(4);
    expect(texture.image.height).toBe(4);
    expect(texture.image.depth).toBe(4);
    texture.dispose();
  });

  it('should convert to FloatType for WebGL2 compatibility', () => {
    const volume = createMockVolume();
    const texture = VolumeTextureBuilder.buildTexture(volume);
    // Data is converted to Float32Array for R32F format
    expect(texture.type).toBe(THREE.FloatType);
    texture.dispose();
  });

  it('should handle both Int16Array and Uint16Array input', () => {
    const volume1 = createMockVolume(); // Int16Array
    const texture1 = VolumeTextureBuilder.buildTexture(volume1);
    expect(texture1.type).toBe(THREE.FloatType);
    texture1.dispose();

    const volume2 = {
      ...createMockVolume(),
      data: new Uint16Array(4 * 4 * 4),
    };
    const texture2 = VolumeTextureBuilder.buildTexture(volume2);
    expect(texture2.type).toBe(THREE.FloatType);
    texture2.dispose();
  });

  it('should use RedFormat', () => {
    const volume = createMockVolume();
    const texture = VolumeTextureBuilder.buildTexture(volume);
    expect(texture.format).toBe(THREE.RedFormat);
    texture.dispose();
  });

  it('should set linear filtering', () => {
    const volume = createMockVolume();
    const texture = VolumeTextureBuilder.buildTexture(volume);
    expect(texture.minFilter).toBe(THREE.LinearFilter);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    texture.dispose();
  });

  it('should set clamp to edge wrapping', () => {
    const volume = createMockVolume();
    const texture = VolumeTextureBuilder.buildTexture(volume);
    expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.wrapR).toBe(THREE.ClampToEdgeWrapping);
    texture.dispose();
  });

  it('should calculate memory size correctly', () => {
    const volume = createMockVolume();
    const bytes = VolumeTextureBuilder.calculateMemorySize(volume);
    expect(bytes).toBe(4 * 4 * 4 * 2); // 128 bytes
  });

  it('should calculate memory size in MB', () => {
    const volume = createMockVolume();
    const mb = VolumeTextureBuilder.calculateMemorySizeMB(volume);
    expect(mb).toBeCloseTo(128 / (1024 * 1024), 6);
  });

  it('should normalize data range with rescale', () => {
    const volume = createMockVolume();
    const normalized = VolumeTextureBuilder.normalizeDataRange(volume);
    // actualMin = 0 * 1 + (-1024) = -1024
    // actualMax = 630 * 1 + (-1024) = -394
    expect(normalized.min).toBe(-1024);
    expect(normalized.max).toBe(-394);
  });

  it('should handle zero-range data without NaN', () => {
    const volume = {
      ...createMockVolume(),
      dataRange: { min: 100, max: 100 },
    };
    const normalized = VolumeTextureBuilder.normalizeDataRange(volume);
    expect(normalized.scale).toBe(1.0);
    expect(Number.isNaN(normalized.offset)).toBe(false);
  });
});

describe('VolumeRenderer aspect ratio', () => {
  it('should calculate aspect ratio normalized to largest dimension', () => {
    // Test the aspect calculation logic directly
    const volume = createMockVolume();
    const { dimensions, spacing } = volume;

    const physicalSize = {
      x: dimensions.x * spacing.x, // 4 * 1 = 4
      y: dimensions.y * spacing.y, // 4 * 1 = 4
      z: dimensions.z * spacing.z, // 4 * 2 = 8
    };

    const maxSize = Math.max(physicalSize.x, physicalSize.y, physicalSize.z);
    expect(maxSize).toBe(8);
    expect(physicalSize.x / maxSize).toBe(0.5);
    expect(physicalSize.y / maxSize).toBe(0.5);
    expect(physicalSize.z / maxSize).toBe(1.0);
  });

  it('should handle isotropic volumes', () => {
    const volume = {
      ...createMockVolume(),
      spacing: { x: 1, y: 1, z: 1 },
    };

    const physicalSize = {
      x: volume.dimensions.x * volume.spacing.x,
      y: volume.dimensions.y * volume.spacing.y,
      z: volume.dimensions.z * volume.spacing.z,
    };

    const maxSize = Math.max(physicalSize.x, physicalSize.y, physicalSize.z);
    expect(physicalSize.x / maxSize).toBe(1.0);
    expect(physicalSize.y / maxSize).toBe(1.0);
    expect(physicalSize.z / maxSize).toBe(1.0);
  });
});
