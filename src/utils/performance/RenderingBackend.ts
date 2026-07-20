/**
 * Rendering backend detection and capability checking
 */

import type { RenderingBackend } from '@/types';

/**
 * Backend capabilities
 */
export interface BackendCapabilities {
  backend: RenderingBackend;
  maxTextureSize: number;
  max3DTextureSize: number;
  maxTextureUnits: number;
  supportsFloat32Textures: boolean;
  supportsFloat16Textures: boolean;
  maxComputeWorkGroupSize?: number; // WebGPU only
}

/**
 * Detect the best available rendering backend
 */
export class RenderingBackendDetector {
  private static instance: RenderingBackendDetector;
  private detectedBackend: RenderingBackend | null = null;
  private capabilities: BackendCapabilities | null = null;

  private constructor() {}

  static getInstance(): RenderingBackendDetector {
    if (!RenderingBackendDetector.instance) {
      RenderingBackendDetector.instance = new RenderingBackendDetector();
    }
    return RenderingBackendDetector.instance;
  }

  /**
   * Detect the best available rendering backend
   */
  async detectBestBackend(): Promise<RenderingBackend> {
    if (this.detectedBackend) {
      return this.detectedBackend;
    }

    // Try WebGPU first
    if (await this.isWebGPUAvailable()) {
      this.detectedBackend = 'webgpu';
      return 'webgpu';
    }

    // Fall back to WebGL2
    if (this.isWebGL2Available()) {
      this.detectedBackend = 'webgl2';
      return 'webgl2';
    }

    // Last resort: WebGL 1
    if (this.isWebGLAvailable()) {
      this.detectedBackend = 'webgl';
      return 'webgl';
    }

    throw new Error('No compatible rendering backend found. WebGL or WebGPU is required.');
  }

  /**
   * Check if WebGPU is available
   */
  private async isWebGPUAvailable(): Promise<boolean> {
    // Type assertion for navigator.gpu (WebGPU API)
    const nav = navigator as Navigator & { gpu?: any };

    if (!nav.gpu) {
      return false;
    }

    try {
      const adapter = await nav.gpu.requestAdapter();
      if (!adapter) {
        return false;
      }

      // Check if adapter supports required features
      const device = await adapter.requestDevice();
      device.destroy(); // Clean up test device

      return true;
    } catch (error) {
      console.warn('WebGPU detection failed:', error);
      return false;
    }
  }

  /**
   * Check if WebGL2 is available
   */
  private isWebGL2Available(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2');
      return context !== null;
    } catch {
      return false;
    }
  }

  /**
   * Check if WebGL 1 is available
   */
  private isWebGLAvailable(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return context !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed capabilities for the detected backend
   */
  async getCapabilities(): Promise<BackendCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    const backend = await this.detectBestBackend();

    if (backend === 'webgpu') {
      this.capabilities = await this.getWebGPUCapabilities();
    } else if (backend === 'webgl2') {
      this.capabilities = this.getWebGL2Capabilities();
    } else {
      this.capabilities = this.getWebGLCapabilities();
    }

    return this.capabilities;
  }

  /**
   * Get WebGPU capabilities
   */
  private async getWebGPUCapabilities(): Promise<BackendCapabilities> {
    const nav = navigator as Navigator & { gpu?: any };
    const adapter = await nav.gpu!.requestAdapter();
    if (!adapter) {
      throw new Error('WebGPU adapter not available');
    }

    const limits = adapter.limits;

    return {
      backend: 'webgpu',
      maxTextureSize: limits.maxTextureDimension2D,
      max3DTextureSize: limits.maxTextureDimension3D,
      maxTextureUnits: 16, // WebGPU doesn't have this concept, using reasonable default
      supportsFloat32Textures: true,
      supportsFloat16Textures: true,
      maxComputeWorkGroupSize: limits.maxComputeWorkgroupSizeX,
    };
  }

  /**
   * Get WebGL2 capabilities
   */
  private getWebGL2Capabilities(): BackendCapabilities {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');

    if (!gl) {
      throw new Error('WebGL2 context not available');
    }

    return {
      backend: 'webgl2',
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      max3DTextureSize: gl.getParameter(gl.MAX_3D_TEXTURE_SIZE),
      maxTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      supportsFloat32Textures: !!gl.getExtension('EXT_color_buffer_float'),
      supportsFloat16Textures: !!gl.getExtension('EXT_color_buffer_half_float'),
    };
  }

  /**
   * Get WebGL 1 capabilities
   */
  private getWebGLCapabilities(): BackendCapabilities {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

    if (!gl) {
      throw new Error('WebGL context not available');
    }

    return {
      backend: 'webgl',
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      max3DTextureSize: 0, // WebGL 1 doesn't support 3D textures natively
      maxTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) as number,
      supportsFloat32Textures: !!gl.getExtension('OES_texture_float'),
      supportsFloat16Textures: !!gl.getExtension('OES_texture_half_float'),
    };
  }

  /**
   * Check if 3D texture support is available
   */
  async supports3DTextures(): Promise<boolean> {
    const caps = await this.getCapabilities();
    return caps.backend === 'webgpu' || caps.backend === 'webgl2';
  }

  /**
   * Get maximum supported volume dimensions
   */
  async getMaxVolumeDimensions(): Promise<{ x: number; y: number; z: number }> {
    const caps = await this.getCapabilities();

    if (caps.backend === 'webgpu' || caps.backend === 'webgl2') {
      return {
        x: caps.max3DTextureSize,
        y: caps.max3DTextureSize,
        z: caps.max3DTextureSize,
      };
    }

    // WebGL 1 fallback (simulate 3D with 2D texture atlas)
    const maxSize = caps.maxTextureSize;
    const maxSlices = Math.floor(maxSize / 512); // Assuming 512x512 slices

    return {
      x: 512,
      y: 512,
      z: maxSlices,
    };
  }

  /**
   * Log detected capabilities to console
   */
  async logCapabilities(): Promise<void> {
    const caps = await this.getCapabilities();

    console.group('🖥️  Rendering Backend Capabilities');
    console.log('Backend:', caps.backend.toUpperCase());
    console.log('Max 2D Texture Size:', caps.maxTextureSize);
    console.log('Max 3D Texture Size:', caps.max3DTextureSize);
    console.log('Max Texture Units:', caps.maxTextureUnits);
    console.log('Float32 Textures:', caps.supportsFloat32Textures ? '✓' : '✗');
    console.log('Float16 Textures:', caps.supportsFloat16Textures ? '✓' : '✗');

    if (caps.maxComputeWorkGroupSize) {
      console.log('Max Compute Work Group Size:', caps.maxComputeWorkGroupSize);
    }

    const maxVol = await this.getMaxVolumeDimensions();
    console.log('Max Volume Dimensions:', `${maxVol.x} × ${maxVol.y} × ${maxVol.z}`);

    console.groupEnd();
  }
}

/**
 * Singleton instance
 */
export const backendDetector = RenderingBackendDetector.getInstance();
