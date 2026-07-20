/**
 * Volume Renderer - Three.js-based volume rendering with ray marching
 */

import * as THREE from 'three';
import type { Volume } from '@/types';
import { VolumeTextureBuilder } from './VolumeTexture';
import vertexShader from './shaders/volume.vert.glsl?raw';
import fragmentShader from './shaders/volume.frag.glsl?raw';

export type VolumeRenderMode = 'composite' | 'mip' | 'minip';
export type VolumeColorMap = 'grayscale' | 'hot' | 'pet';

// Shader uniform ids for the string enums above.
export const RENDER_MODE_ID: Record<VolumeRenderMode, number> = { composite: 0, mip: 1, minip: 2 };
export const COLOR_MAP_ID: Record<VolumeColorMap, number> = { grayscale: 0, hot: 1, pet: 2 };

export interface VolumeRenderSettings {
  windowLevel: number;
  windowWidth: number;
  opacity: number;
  stepSize: number;
  maxSteps: number;
  renderMode: VolumeRenderMode;
  colorMap: VolumeColorMap;
  clipEnabled: boolean;
  clipMin: [number, number, number]; // texture-space 0..1 lower bounds per axis
  clipMax: [number, number, number]; // texture-space 0..1 upper bounds per axis
}

export interface RendererStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
  maxSteps: number;
}

/**
 * Renders medical volumes using GPU ray marching
 */
export class VolumeRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private volumeMesh: THREE.Mesh | null = null;
  private volumeTexture: THREE.Data3DTexture | null = null;
  private currentVolume: Volume | null = null;

  private animationFrameId: number | null = null;
  private beforeRender: (() => void) | null = null;

  // Rolling frame stats for the dev debug HUD.
  private lastFrameTime = 0;
  private frameMs = 0;
  private fpsEma = 0;

  constructor(canvas: HTMLCanvasElement) {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000); // Pure black (medical imaging standard)

    // Create camera with closer initial position for better framing
    this.camera = new THREE.PerspectiveCamera(
      45, // FOV
      canvas.width / canvas.height,
      0.1,
      1000
    );
    this.camera.position.set(1.0, 1.0, 1.0);
    this.camera.lookAt(0, 0, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true, // Needed for readPixels to work reliably
    });
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  /**
   * Load and render a volume
   */
  loadVolume(volume: Volume, settings: VolumeRenderSettings): void {
    // Clean up previous volume
    this.dispose();

    this.currentVolume = volume;

    console.log('[VolumeRenderer] Loading volume:', volume.dimensions);

    // Create 3D texture
    try {
      this.volumeTexture = VolumeTextureBuilder.buildTexture(volume);
      console.log('[VolumeRenderer] 3D texture created');
    } catch (error) {
      console.error('[VolumeRenderer] Failed to create texture:', error);
      return;
    }

    const normalized = VolumeTextureBuilder.normalizeDataRange(volume);

    // Create volume material with ray marching shader
    const material = new THREE.ShaderMaterial({
      uniforms: {
        volumeTexture: { value: this.volumeTexture },
        volumeDimensions: {
          value: new THREE.Vector3(
            volume.dimensions.x,
            volume.dimensions.y,
            volume.dimensions.z
          ),
        },
        uCameraPosition: { value: new THREE.Vector3() },
        windowLevel: { value: settings.windowLevel },
        windowWidth: { value: settings.windowWidth },
        opacity: { value: settings.opacity },
        stepSize: { value: settings.stepSize },
        maxSteps: { value: settings.maxSteps },
        dataMin: { value: normalized.min },
        dataMax: { value: normalized.max },
        renderMode: { value: RENDER_MODE_ID[settings.renderMode] },
        colorMap: { value: COLOR_MAP_ID[settings.colorMap] },
        clipMin: { value: new THREE.Vector3(...(settings.clipEnabled ? settings.clipMin : [0, 0, 0])) },
        clipMax: { value: new THREE.Vector3(...(settings.clipEnabled ? settings.clipMax : [1, 1, 1])) },
      },
      vertexShader,
      fragmentShader,
      side: THREE.FrontSide, // Render front faces (camera sees these from outside)
      transparent: true,
      depthWrite: false,
    });


    // Create volume geometry (unit cube)
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    // Create mesh
    this.volumeMesh = new THREE.Mesh(geometry, material);

    const aspect = this.calculateAspectRatio(volume);
    this.volumeMesh.scale.set(aspect.x, aspect.y, aspect.z);

    this.scene.add(this.volumeMesh);

    // Check for WebGL errors
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const glError = gl.getError();
    if (glError !== gl.NO_ERROR) {
      console.error('[VolumeRenderer] WebGL error after setup:', glError);
    }

    // Start render loop
    this.startRenderLoop();
  }

  /**
   * Calculate volume aspect ratio for proper scaling
   */
  private calculateAspectRatio(volume: Volume): THREE.Vector3 {
    const { dimensions, spacing } = volume;

    // Physical size in mm
    const physicalSize = {
      x: dimensions.x * spacing.x,
      y: dimensions.y * spacing.y,
      z: dimensions.z * spacing.z,
    };

    // Normalize to largest dimension
    const maxSize = Math.max(physicalSize.x, physicalSize.y, physicalSize.z);

    return new THREE.Vector3(
      physicalSize.x / maxSize,
      physicalSize.y / maxSize,
      physicalSize.z / maxSize
    );
  }

  /**
   * Update rendering settings
   */
  updateSettings(settings: Partial<VolumeRenderSettings>): void {
    if (!this.volumeMesh) return;

    const material = this.volumeMesh.material as THREE.ShaderMaterial;
    const u = material.uniforms;

    if (settings.windowLevel !== undefined && u['windowLevel']) {
      u['windowLevel'].value = settings.windowLevel;
    }
    if (settings.windowWidth !== undefined && u['windowWidth']) {
      u['windowWidth'].value = settings.windowWidth;
    }
    if (settings.opacity !== undefined && u['opacity']) {
      u['opacity'].value = settings.opacity;
    }
    if (settings.stepSize !== undefined && u['stepSize']) {
      u['stepSize'].value = settings.stepSize;
    }
    if (settings.maxSteps !== undefined && u['maxSteps']) {
      u['maxSteps'].value = settings.maxSteps;
    }
    if (settings.renderMode !== undefined && u['renderMode']) {
      u['renderMode'].value = RENDER_MODE_ID[settings.renderMode];
    }
    if (settings.colorMap !== undefined && u['colorMap']) {
      u['colorMap'].value = COLOR_MAP_ID[settings.colorMap];
    }
    // Clip box depends on enabled + bounds together; recompute when any is present.
    if (
      settings.clipEnabled !== undefined ||
      settings.clipMin !== undefined ||
      settings.clipMax !== undefined
    ) {
      const on = settings.clipEnabled ?? true;
      if (u['clipMin']) u['clipMin'].value.set(...(on ? (settings.clipMin ?? [0, 0, 0]) : [0, 0, 0]));
      if (u['clipMax']) u['clipMax'].value.set(...(on ? (settings.clipMax ?? [1, 1, 1]) : [1, 1, 1]));
    }
  }

  /**
   * Update camera position uniform for ray marching
   * Transform camera from world space to model space
   */
  private updateCameraUniform(): void {
    if (!this.volumeMesh) return;

    const material = this.volumeMesh.material as any;

    // Only update if this is a ShaderMaterial with uniforms
    if (!material.uniforms) return;

    const camUniform = material.uniforms['uCameraPosition'];
    if (camUniform) {
      // Manually transform camera position accounting for mesh scale
      // Since mesh is at origin with only scale transformation:
      // modelSpace = worldSpace / scale
      const cameraModelSpace = new THREE.Vector3(
        this.camera.position.x / this.volumeMesh.scale.x,
        this.camera.position.y / this.volumeMesh.scale.y,
        this.camera.position.z / this.volumeMesh.scale.z
      );
      camUniform.value.copy(cameraModelSpace);
    }
  }

  /**
   * Resize renderer
   */
  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Start render loop
   */
  private startRenderLoop(): void {
    this.stopRenderLoop();

    const render = () => {
      this.animationFrameId = requestAnimationFrame(render);
      this.beforeRender?.();
      this.updateCameraUniform();
      this.renderer.render(this.scene, this.camera);

      const now = performance.now();
      if (this.lastFrameTime > 0) {
        this.frameMs = now - this.lastFrameTime;
        const instFps = 1000 / this.frameMs;
        this.fpsEma = this.fpsEma > 0 ? this.fpsEma * 0.9 + instFps * 0.1 : instFps;
      }
      this.lastFrameTime = now;
    };

    render();
  }

  /**
   * Stop render loop
   */
  private stopRenderLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Get camera for external control
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Renderer performance snapshot for the dev debug HUD.
   */
  getStats(): RendererStats {
    const info = this.renderer.info;
    return {
      fps: Math.round(this.fpsEma),
      frameMs: this.frameMs,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      textures: info.memory.textures,
      geometries: info.memory.geometries,
      maxSteps: this.currentVolume ? this.getMaxSteps() : 0,
    };
  }

  private getMaxSteps(): number {
    const material = this.volumeMesh?.material as THREE.ShaderMaterial | undefined;
    return material?.uniforms['maxSteps']?.value ?? 0;
  }

  /**
   * Register a callback run once per frame before the camera uniform update and
   * render — used to drive OrbitControls damping from the single RAF loop.
   */
  setBeforeRender(callback: (() => void) | null): void {
    this.beforeRender = callback;
  }

  /**
   * Get renderer for external control
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * Get scene for external access
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  getVolume(): Volume | null {
    return this.currentVolume;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopRenderLoop();

    if (this.volumeMesh) {
      this.volumeMesh.geometry.dispose();
      (this.volumeMesh.material as THREE.Material).dispose();
      this.scene.remove(this.volumeMesh);
      this.volumeMesh = null;
    }

    if (this.volumeTexture) {
      VolumeTextureBuilder.disposeTexture(this.volumeTexture);
      this.volumeTexture = null;
    }

    this.currentVolume = null;
  }

  /**
   * Complete cleanup including renderer
   */
  destroy(): void {
    this.dispose();
    this.renderer.dispose();
  }
}
