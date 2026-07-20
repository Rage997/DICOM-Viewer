/**
 * Volume Texture - Converts Volume data to Three.js 3D texture
 */

import * as THREE from 'three';
import type { Volume } from '@/types';

/**
 * Create 3D texture from volume data
 */
export class VolumeTextureBuilder {
  /**
   * Build Three.js Data3DTexture from Volume
   */
  static buildTexture(volume: Volume): THREE.Data3DTexture {
    const { dimensions, data } = volume;

    // Convert 16-bit integer data to 32-bit float for proper texture sampling
    // This is necessary because WebGL2 R32F format requires float data, not integers
    const floatData = new Float32Array(data.length);

    // Normalize to 0-1 range for shader sampling
    const { dataRange } = volume;
    const range = dataRange.max - dataRange.min;
    const scale = range !== 0 ? 1.0 / range : 1.0;

    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      floatData[i] = value !== undefined ? (value - dataRange.min) * scale : 0;
    }

    // Create 3D texture with float data
    const texture = new THREE.Data3DTexture(
      floatData,
      dimensions.x,
      dimensions.y,
      dimensions.z
    );

    // Configure texture format for float data
    texture.format = THREE.RedFormat;
    texture.type = THREE.FloatType;
    texture.internalFormat = 'R32F';  // 32-bit float for compatibility

    // Configure filtering
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // No wrapping for medical volumes
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapR = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    // Unpack alignment (1 byte = no padding)
    texture.unpackAlignment = 1;

    // Mark for upload
    texture.needsUpdate = true;

    return texture;
  }

  /**
   * Calculate texture memory size in bytes
   */
  static calculateMemorySize(volume: Volume): number {
    const { dimensions } = volume;
    const voxelCount = dimensions.x * dimensions.y * dimensions.z;

    // 2 bytes per voxel (16-bit data)
    return voxelCount * 2;
  }

  /**
   * Calculate texture memory size in MB
   */
  static calculateMemorySizeMB(volume: Volume): number {
    return this.calculateMemorySize(volume) / (1024 * 1024);
  }

  /**
   * Normalize volume data to 0-1 range for shader sampling
   */
  static normalizeDataRange(volume: Volume): {
    min: number;
    max: number;
    scale: number;
    offset: number;
  } {
    const { dataRange, rescaleSlope, rescaleIntercept } = volume;

    // Apply rescale to get actual values (e.g., Hounsfield Units)
    const actualMin = dataRange.min * rescaleSlope + rescaleIntercept;
    const actualMax = dataRange.max * rescaleSlope + rescaleIntercept;

    // Calculate normalization parameters
    const range = actualMax - actualMin;
    const scale = range !== 0 ? 1.0 / range : 1.0;
    const offset = -actualMin * scale;

    return {
      min: actualMin,
      max: actualMax,
      scale,
      offset,
    };
  }

  /**
   * Dispose of texture and free GPU memory
   */
  static disposeTexture(texture: THREE.Data3DTexture): void {
    texture.dispose();
  }
}
