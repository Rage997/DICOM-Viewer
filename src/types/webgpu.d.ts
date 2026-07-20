/**
 * WebGPU type definitions
 * Based on the WebGPU specification
 */

interface GPU {
  requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
}

interface GPURequestAdapterOptions {
  powerPreference?: 'low-power' | 'high-performance';
  forceFallbackAdapter?: boolean;
}

interface GPUAdapter {
  readonly features: GPUSupportedFeatures;
  readonly limits: GPUSupportedLimits;
  readonly isFallbackAdapter: boolean;

  requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
}

interface GPUSupportedFeatures extends Set<string> {}

interface GPUSupportedLimits {
  readonly maxTextureDimension1D: number;
  readonly maxTextureDimension2D: number;
  readonly maxTextureDimension3D: number;
  readonly maxTextureArrayLayers: number;
  readonly maxBindGroups: number;
  readonly maxDynamicUniformBuffersPerPipelineLayout: number;
  readonly maxDynamicStorageBuffersPerPipelineLayout: number;
  readonly maxSampledTexturesPerShaderStage: number;
  readonly maxSamplersPerShaderStage: number;
  readonly maxStorageBuffersPerShaderStage: number;
  readonly maxStorageTexturesPerShaderStage: number;
  readonly maxUniformBuffersPerShaderStage: number;
  readonly maxUniformBufferBindingSize: number;
  readonly maxStorageBufferBindingSize: number;
  readonly minUniformBufferOffsetAlignment: number;
  readonly minStorageBufferOffsetAlignment: number;
  readonly maxVertexBuffers: number;
  readonly maxVertexAttributes: number;
  readonly maxVertexBufferArrayStride: number;
  readonly maxInterStageShaderComponents: number;
  readonly maxComputeWorkgroupStorageSize: number;
  readonly maxComputeInvocationsPerWorkgroup: number;
  readonly maxComputeWorkgroupSizeX: number;
  readonly maxComputeWorkgroupSizeY: number;
  readonly maxComputeWorkgroupSizeZ: number;
  readonly maxComputeWorkgroupsPerDimension: number;
}

interface GPUDeviceDescriptor {
  label?: string;
  requiredFeatures?: Iterable<string>;
  requiredLimits?: Record<string, number>;
}

interface GPUDevice extends EventTarget {
  readonly features: GPUSupportedFeatures;
  readonly limits: GPUSupportedLimits;
  readonly queue: GPUQueue;

  destroy(): void;

  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
  createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
  createSampler(descriptor?: GPUSamplerDescriptor): GPUSampler;

  createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
  createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
  createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;

  createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
  createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
  createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline;

  createCommandEncoder(descriptor?: GPUCommandEncoderDescriptor): GPUCommandEncoder;
  createRenderBundleEncoder(descriptor: GPURenderBundleEncoderDescriptor): GPURenderBundleEncoder;

  createQuerySet(descriptor: GPUQuerySetDescriptor): GPUQuerySet;

  pushErrorScope(filter: GPUErrorFilter): void;
  popErrorScope(): Promise<GPUError | null>;

  readonly lost: Promise<GPUDeviceLostInfo>;

  onuncapturederror: ((this: GPUDevice, ev: GPUUncapturedErrorEvent) => unknown) | null;
}

interface GPUQueue {
  submit(commandBuffers: Iterable<GPUCommandBuffer>): void;
  onSubmittedWorkDone(): Promise<void>;
  writeBuffer(
    buffer: GPUBuffer,
    bufferOffset: number,
    data: BufferSource,
    dataOffset?: number,
    size?: number
  ): void;
  writeTexture(
    destination: GPUImageCopyTexture,
    data: BufferSource,
    dataLayout: GPUImageDataLayout,
    size: GPUExtent3D
  ): void;
}

interface GPUBuffer {}
interface GPUTexture {}
interface GPUSampler {}
interface GPUBindGroupLayout {}
interface GPUPipelineLayout {}
interface GPUBindGroup {}
interface GPUShaderModule {}
interface GPUComputePipeline {}
interface GPURenderPipeline {}
interface GPUCommandEncoder {}
interface GPURenderBundleEncoder {}
interface GPUQuerySet {}
interface GPUCommandBuffer {}

interface GPUBufferDescriptor {}
interface GPUTextureDescriptor {}
interface GPUSamplerDescriptor {}
interface GPUBindGroupLayoutDescriptor {}
interface GPUPipelineLayoutDescriptor {}
interface GPUBindGroupDescriptor {}
interface GPUShaderModuleDescriptor {}
interface GPUComputePipelineDescriptor {}
interface GPURenderPipelineDescriptor {}
interface GPUCommandEncoderDescriptor {}
interface GPURenderBundleEncoderDescriptor {}
interface GPUQuerySetDescriptor {}
interface GPUImageCopyTexture {}
interface GPUImageDataLayout {}
interface GPUExtent3D {}

type GPUErrorFilter = 'out-of-memory' | 'validation';

interface GPUError {
  readonly message: string;
}

interface GPUDeviceLostInfo {
  readonly reason: 'unknown' | 'destroyed';
  readonly message: string;
}

interface GPUUncapturedErrorEvent extends Event {
  readonly error: GPUError;
}

declare global {
  interface Navigator {
    readonly gpu?: GPU;
  }
}

export {};
