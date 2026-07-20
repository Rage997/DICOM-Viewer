import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Camera controls for the 3D volume view — a thin wrapper over Three's
 * OrbitControls (damped rotate/pan, proportional wheel zoom, drag past the
 * canvas edge, touch gestures). `update()` must run once per frame for damping.
 *
 * The orbit "up" axis stays +Y for all views: OrbitControls fixes its orbit
 * quaternion at construction from camera.up, so flipping up per-view would
 * desync it. Top/Bottom are handled as the poles (OrbitControls clamps them).
 */

const MIN_DISTANCE = 0.3;
const MAX_DISTANCE = 10;
const VIEW_DISTANCE = 1.2; // framing distance for anatomical presets
const DEFAULT_POSITION: [number, number, number] = [1, 1, 1];

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    camera.up.set(0, 1, 0);

    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.9;
    controls.zoomSpeed = 0.9;
    controls.panSpeed = 0.8;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = MAX_DISTANCE;
    controls.target.set(0, 0, 0);
    controls.update();

    this.controls = controls;
  }

  /** Advance damping / apply pending input. Call once per frame. */
  update(): void {
    this.controls.update();
  }

  /**
   * Move the camera to a programmatic view that snaps cleanly. First update()
   * with damping off flushes any residual momentum from a prior drag to zero;
   * `mutate` then sets the new camera position/target; the final update() (delta
   * now zero) lands exactly there. Damping is restored for interactive input.
   */
  private snapTo(mutate: () => void): void {
    this.controls.enableDamping = false;
    this.controls.update(); // flush residual sphericalDelta / panOffset to zero
    mutate();
    this.controls.update(); // clean snap to the new position
    this.controls.enableDamping = true;
  }

  private applyView(position: [number, number, number]): void {
    this.snapTo(() => {
      this.controls.target.set(0, 0, 0);
      this.camera.position.set(...position);
    });
  }

  resetToDefault(): void {
    this.applyView(DEFAULT_POSITION);
  }

  setAnteriorView(): void {
    this.applyView([0, 0, VIEW_DISTANCE]);
  }

  setPosteriorView(): void {
    this.applyView([0, 0, -VIEW_DISTANCE]);
  }

  setLeftLateralView(): void {
    this.applyView([-VIEW_DISTANCE, 0, 0]);
  }

  setRightLateralView(): void {
    this.applyView([VIEW_DISTANCE, 0, 0]);
  }

  setSuperiorView(): void {
    // Tiny z offset avoids the exact +Y pole (degenerate lookAt).
    this.applyView([0, VIEW_DISTANCE, 0.0001]);
  }

  setInferiorView(): void {
    this.applyView([0, -VIEW_DISTANCE, 0.0001]);
  }

  zoomIn(factor = 0.8): void {
    this.dolly(factor);
  }

  zoomOut(factor = 1.25): void {
    this.dolly(factor);
  }

  /** Scale the camera→target distance by `factor`, clamped, then resync. */
  private dolly(factor: number): void {
    this.snapTo(() => {
      const { target } = this.controls;
      const offset = this.camera.position.clone().sub(target);
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, MIN_DISTANCE, MAX_DISTANCE));
      this.camera.position.copy(target).add(offset);
    });
  }

  dispose(): void {
    this.controls.dispose();
  }
}
