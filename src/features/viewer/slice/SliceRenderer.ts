import type { Volume, SliceOrientation } from '@/types';

export class SliceRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private volume: Volume | null = null;
  private orientation: SliceOrientation;
  private sliceIndex = 0;
  private windowLevel = 40;
  private windowWidth = 400;
  private invert = false;
  private zoom = 1;
  private panX = 0;
  private panY = 0;

  constructor(canvas: HTMLCanvasElement, orientation: SliceOrientation) {
    this.canvas = canvas;
    this.orientation = orientation;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;
  }

  setVolume(volume: Volume): void {
    this.volume = volume;
    if (volume.windowLevel !== undefined) this.windowLevel = volume.windowLevel;
    if (volume.windowWidth !== undefined) this.windowWidth = volume.windowWidth;
    this.sliceIndex = Math.floor(this.getMaxIndex() / 2);

    // Force canvas resize to ensure proper aspect ratio
    this.resize();
  }

  setSliceIndex(index: number): void {
    if (!this.volume) return;
    this.sliceIndex = Math.max(0, Math.min(index, this.getMaxIndex() - 1));
    this.render();
  }

  setWindowLevel(level: number, width: number): void {
    this.windowLevel = level;
    this.windowWidth = width;
    this.render();
  }

  setInvert(invert: boolean): void {
    if (this.invert === invert) return;
    this.invert = invert;
    this.render();
  }

  setViewTransform(zoom: number, panX: number, panY: number): void {
    this.zoom = zoom;
    this.panX = panX;
    this.panY = panY;
    this.render();
  }

  getSliceIndex(): number {
    return this.sliceIndex;
  }

  getMaxIndex(): number {
    if (!this.volume) return 0;
    const { dimensions } = this.volume;
    switch (this.orientation) {
      case 'axial': return dimensions.z;
      case 'sagittal': return dimensions.x;
      case 'coronal': return dimensions.y;
    }
  }

  private getSliceDimensions(): { width: number; height: number } {
    if (!this.volume) return { width: 0, height: 0 };
    const { dimensions } = this.volume;
    switch (this.orientation) {
      case 'axial': return { width: dimensions.x, height: dimensions.y };
      case 'sagittal': return { width: dimensions.y, height: dimensions.z };
      case 'coronal': return { width: dimensions.x, height: dimensions.z };
    }
  }

  render(): void {
    if (!this.volume) return;

    const { width, height } = this.getSliceDimensions();
    if (width === 0 || height === 0) return;

    // Ensure canvas size matches container
    const canvasWidth = this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || 512;
    const canvasHeight = this.canvas.clientHeight || this.canvas.parentElement?.clientHeight || 512;

    if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
      this.canvas.width = canvasWidth;
      this.canvas.height = canvasHeight;
    }

    const imageData = this.ctx.createImageData(width, height);
    const pixels = imageData.data;

    const { data, dimensions, rescaleSlope, rescaleIntercept } = this.volume;
    const windowMin = this.windowLevel - this.windowWidth / 2;
    const windowMax = this.windowLevel + this.windowWidth / 2;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const voxelIndex = this.getVoxelIndex(col, row, dimensions);
        const rawValue = data[voxelIndex] ?? 0;
        const value = rawValue * rescaleSlope + rescaleIntercept;

        let intensity: number;
        if (value <= windowMin) intensity = 0;
        else if (value >= windowMax) intensity = 255;
        else intensity = ((value - windowMin) / (windowMax - windowMin)) * 255;
        if (this.invert) intensity = 255 - intensity;

        const pixelOffset = (row * width + col) * 4;
        pixels[pixelOffset] = intensity;
        pixels[pixelOffset + 1] = intensity;
        pixels[pixelOffset + 2] = intensity;
        pixels[pixelOffset + 3] = 255;
      }
    }

    const offscreen = new OffscreenCanvas(width, height);
    const offCtx = offscreen.getContext('2d')!;
    offCtx.putImageData(imageData, 0, 0);

    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const baseScale = Math.min(this.canvas.width / width, this.canvas.height / height);
    const scale = baseScale * this.zoom;
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    const offsetX = (this.canvas.width - drawWidth) / 2 + this.panX;
    const offsetY = (this.canvas.height - drawHeight) / 2 + this.panY;

    this.ctx.drawImage(offscreen, offsetX, offsetY, drawWidth, drawHeight);
  }

  private getVoxelIndex(
    col: number,
    row: number,
    dimensions: { x: number; y: number; z: number }
  ): number {
    switch (this.orientation) {
      case 'axial': {
        const z = this.sliceIndex;
        return z * dimensions.x * dimensions.y + row * dimensions.x + col;
      }
      case 'sagittal': {
        const x = this.sliceIndex;
        const z = dimensions.z - 1 - row;
        return z * dimensions.x * dimensions.y + col * dimensions.x + x;
      }
      case 'coronal': {
        const y = this.sliceIndex;
        const z = dimensions.z - 1 - row;
        return z * dimensions.x * dimensions.y + y * dimensions.x + col;
      }
    }
  }

  resize(): void {
    this.render();
  }

  dispose(): void {
    this.volume = null;
  }
}
