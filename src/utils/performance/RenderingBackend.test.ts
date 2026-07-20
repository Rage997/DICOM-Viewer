/**
 * Tests for RenderingBackend detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RenderingBackendDetector } from './RenderingBackend';

describe('RenderingBackendDetector', () => {
  let detector: RenderingBackendDetector;

  beforeEach(() => {
    detector = RenderingBackendDetector.getInstance();
  });

  describe('detectBestBackend', () => {
    it('should detect a rendering backend', async () => {
      const backend = await detector.detectBestBackend();

      expect(backend).toMatch(/^(webgpu|webgl2|webgl)$/);
    });

    it('should return same backend on multiple calls', async () => {
      const backend1 = await detector.detectBestBackend();
      const backend2 = await detector.detectBestBackend();

      expect(backend1).toBe(backend2);
    });

    it('should fallback to WebGL when WebGPU unavailable', async () => {
      // navigator.gpu is undefined in test environment
      const backend = await detector.detectBestBackend();

      expect(backend).toMatch(/^(webgl2|webgl)$/);
    });
  });

  describe('getCapabilities', () => {
    it('should return capabilities object', async () => {
      const caps = await detector.getCapabilities();

      expect(caps).toHaveProperty('backend');
      expect(caps).toHaveProperty('maxTextureSize');
      expect(caps).toHaveProperty('max3DTextureSize');
      expect(caps).toHaveProperty('maxTextureUnits');
      expect(caps).toHaveProperty('supportsFloat32Textures');
      expect(caps).toHaveProperty('supportsFloat16Textures');
    });

    it('should return same capabilities on multiple calls', async () => {
      const caps1 = await detector.getCapabilities();
      const caps2 = await detector.getCapabilities();

      expect(caps1).toEqual(caps2);
    });

    it.skip('should have valid texture size limits', async () => {
      // Skip in test environment - WebGL mocking is complex
      const caps = await detector.getCapabilities();

      expect(caps.maxTextureSize).toBeGreaterThan(0);
      expect(caps.maxTextureUnits).toBeGreaterThan(0);
    });
  });

  describe('supports3DTextures', () => {
    it('should check 3D texture support', async () => {
      const supports = await detector.supports3DTextures();

      expect(typeof supports).toBe('boolean');
    });
  });

  describe('getMaxVolumeDimensions', () => {
    it('should return volume dimensions object', async () => {
      const dims = await detector.getMaxVolumeDimensions();

      // Check structure is correct
      expect(dims).toHaveProperty('x');
      expect(dims).toHaveProperty('y');
      expect(dims).toHaveProperty('z');
    });

    it.skip('should return reasonable limits for WebGL2', async () => {
      // Skip in test environment - requires full WebGL context
      const backend = await detector.detectBestBackend();

      if (backend === 'webgl2' || backend === 'webgpu') {
        const dims = await detector.getMaxVolumeDimensions();

        // Should support at least 512^3 on modern hardware
        expect(dims.x).toBeGreaterThanOrEqual(512);
        expect(dims.y).toBeGreaterThanOrEqual(512);
      }
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = RenderingBackendDetector.getInstance();
      const instance2 = RenderingBackendDetector.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
