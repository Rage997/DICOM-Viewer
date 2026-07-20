import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Node 20 (Vitest runtime) lacks Promise.withResolvers; production browsers have
// it. Polyfill so code using it runs under tests. Implementing the primitive is
// the one place the Promise executor form is required.
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers<T>(): PromiseWithResolvers<T> {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

afterEach(() => {
  cleanup();
});

// Mock Web Worker
class MockWorker {
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(stringUrl: string | URL) {
    this.url = stringUrl.toString();
  }

  postMessage(_msg: any) {}
  terminate() {}
}

(globalThis as any).Worker = MockWorker;

// Mock navigator.gpu
Object.defineProperty(navigator, 'gpu', {
  writable: true,
  value: undefined,
});

// Mock OffscreenCanvas
class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
  }
  getContext(_type: string) {
    return {
      putImageData: () => {},
      drawImage: () => {},
      clearRect: () => {},
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
    };
  }
  transferToImageBitmap() { return {}; }
}

(globalThis as any).OffscreenCanvas = MockOffscreenCanvas;

// Full mock WebGL2 context for Three.js
function createMockWebGLContext() {
  const noop = () => {};
  const shaderMock = {};
  const programMock = {};
  const bufferMock = {};
  const textureMock = {};
  const framebufferMock = {};

  return {
    canvas: { width: 256, height: 256 },
    drawingBufferWidth: 256,
    drawingBufferHeight: 256,
    getParameter: (param: number) => {
      if (param === 0x0D33) return 4096; // MAX_TEXTURE_SIZE
      if (param === 0x8073) return 2048; // MAX_3D_TEXTURE_SIZE
      if (param === 0x8872) return 16;   // MAX_TEXTURE_IMAGE_UNITS
      if (param === 0x8B4D) return 32;   // MAX_COMBINED_TEXTURE_IMAGE_UNITS
      if (param === 0x8B4C) return 256;  // MAX_VERTEX_UNIFORM_VECTORS
      if (param === 0x8DFD) return 256;  // MAX_FRAGMENT_UNIFORM_VECTORS
      if (param === 0x8869) return 16;   // MAX_VERTEX_ATTRIBS
      if (param === 0x851C) return 16;   // MAX_VERTEX_TEXTURE_IMAGE_UNITS
      if (param === 0x0D34) return 16;   // MAX_VIEWPORT_DIMS
      if (param === 0x9122) return 8;    // MAX_DRAW_BUFFERS
      if (param === 0x8D57) return 8;    // MAX_COLOR_ATTACHMENTS
      if (param === 0x8C2B) return 16;   // MAX_VARYING_VECTORS
      if (param === 0x1F02) return 'WebGL 2.0 (Mock)'; // VERSION (must match Three's /^WebGL (\d)/)
      if (param === 0x1F01) return 'Mock'; // RENDERER
      if (param === 0x1F00) return 'Mock'; // VENDOR
      if (param === 0x8B8C) return 'WebGL GLSL ES 3.00 (Mock)'; // SHADING_LANGUAGE_VERSION
      return 0;
    },
    getError: () => 0, // NO_ERROR
    getExtension: (name: string) => {
      if (name === 'EXT_color_buffer_float') return {};
      if (name === 'EXT_color_buffer_half_float') return {};
      if (name === 'OES_texture_float_linear') return {};
      if (name === 'OES_texture_half_float_linear') return {};
      if (name === 'WEBGL_compressed_texture_s3tc') return {};
      return null;
    },
    getSupportedExtensions: () => ['EXT_color_buffer_float'],
    getShaderPrecisionFormat: () => ({
      rangeMin: 127,
      rangeMax: 127,
      precision: 23,
    }),
    createShader: () => shaderMock,
    shaderSource: noop,
    compileShader: noop,
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    createProgram: () => programMock,
    attachShader: noop,
    linkProgram: noop,
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    deleteShader: noop,
    deleteProgram: noop,
    useProgram: noop,
    getAttribLocation: () => 0,
    getUniformLocation: () => ({}),
    uniform1i: noop,
    uniform1f: noop,
    uniform2f: noop,
    uniform3f: noop,
    uniform4f: noop,
    uniform1fv: noop,
    uniform2fv: noop,
    uniform3fv: noop,
    uniform4fv: noop,
    uniformMatrix3fv: noop,
    uniformMatrix4fv: noop,
    createBuffer: () => bufferMock,
    bindBuffer: noop,
    bufferData: noop,
    deleteBuffer: noop,
    createTexture: () => textureMock,
    bindTexture: noop,
    texImage2D: noop,
    texImage3D: noop,
    texSubImage2D: noop,
    texSubImage3D: noop,
    texParameteri: noop,
    texParameterf: noop,
    deleteTexture: noop,
    activeTexture: noop,
    generateMipmap: noop,
    pixelStorei: noop,
    createFramebuffer: () => framebufferMock,
    bindFramebuffer: noop,
    framebufferTexture2D: noop,
    checkFramebufferStatus: () => 0x8CD5, // FRAMEBUFFER_COMPLETE
    deleteFramebuffer: noop,
    createRenderbuffer: () => ({}),
    bindRenderbuffer: noop,
    renderbufferStorage: noop,
    renderbufferStorageMultisample: noop,
    framebufferRenderbuffer: noop,
    deleteRenderbuffer: noop,
    createVertexArray: () => ({}),
    bindVertexArray: noop,
    deleteVertexArray: noop,
    enableVertexAttribArray: noop,
    disableVertexAttribArray: noop,
    vertexAttribPointer: noop,
    vertexAttribDivisor: noop,
    viewport: noop,
    scissor: noop,
    enable: noop,
    disable: noop,
    blendFunc: noop,
    blendFuncSeparate: noop,
    blendEquation: noop,
    blendEquationSeparate: noop,
    blendColor: noop,
    depthFunc: noop,
    depthMask: noop,
    colorMask: noop,
    stencilFunc: noop,
    stencilOp: noop,
    stencilMask: noop,
    cullFace: noop,
    frontFace: noop,
    lineWidth: noop,
    polygonOffset: noop,
    clear: noop,
    clearColor: noop,
    clearDepth: noop,
    clearStencil: noop,
    drawArrays: noop,
    drawElements: noop,
    drawArraysInstanced: noop,
    drawElementsInstanced: noop,
    readPixels: noop,
    getContextAttributes: () => ({
      alpha: true,
      antialias: true,
      depth: true,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    }),
    isContextLost: () => false,
    getActiveAttrib: () => ({ size: 1, type: 0x1406, name: 'a' }),
    getActiveUniform: () => ({ size: 1, type: 0x1406, name: 'u' }),
    drawBuffers: noop,
    readBuffer: noop,
    blitFramebuffer: noop,
    invalidateFramebuffer: noop,
    texStorage2D: noop,
    texStorage3D: noop,
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    STATIC_DRAW: 0x88E4,
    DYNAMIC_DRAW: 0x88E8,
    FLOAT: 0x1406,
    UNSIGNED_SHORT: 0x1403,
    UNSIGNED_INT: 0x1405,
    TRIANGLES: 0x0004,
    TEXTURE_2D: 0x0DE1,
    TEXTURE_3D: 0x806F,
    TEXTURE0: 0x84C0,
    RGBA: 0x1908,
    RGB: 0x1907,
    RED: 0x1903,
    DEPTH_COMPONENT: 0x1902,
    DEPTH_COMPONENT16: 0x81A5,
    DEPTH_COMPONENT24: 0x81A6,
    DEPTH_COMPONENT32F: 0x8CAC,
    FRAMEBUFFER: 0x8D40,
    RENDERBUFFER: 0x8D41,
    COLOR_ATTACHMENT0: 0x8CE0,
    DEPTH_ATTACHMENT: 0x8D00,
    STENCIL_ATTACHMENT: 0x8D20,
    FRAMEBUFFER_COMPLETE: 0x8CD5,
    COMPILE_STATUS: 0x8B81,
    LINK_STATUS: 0x8B82,
    VERTEX_SHADER: 0x8B31,
    FRAGMENT_SHADER: 0x8B30,
    LINEAR: 0x2601,
    NEAREST: 0x2600,
    CLAMP_TO_EDGE: 0x812F,
    REPEAT: 0x2901,
    UNPACK_ALIGNMENT: 0x0CF5,
    BACK: 0x0405,
    FRONT: 0x0404,
    CW: 0x0900,
    CCW: 0x0901,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    TEXTURE_WRAP_R: 0x8072,
    R16F: 0x822D,
    R32F: 0x822E,
    RG16F: 0x822F,
    RGBA16F: 0x881A,
    RGBA32F: 0x8814,
    HALF_FLOAT: 0x140B,
    UNSIGNED_BYTE: 0x1401,
    SHORT: 0x1402,
    VERSION: 0x1F02,
    SHADING_LANGUAGE_VERSION: 0x8B8C,
    MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0x8B4D,
    NO_ERROR: 0,
  };
}

// Mock canvas 2D context
function createMock2DContext() {
  return {
    putImageData: () => {},
    drawImage: () => {},
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    setTransform: () => {},
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    canvas: null as any,
  };
}

// Patch document.createElement
const originalCreateElement = document.createElement.bind(document);
document.createElement = ((tagName: string) => {
  if (tagName === 'canvas') {
    const canvas = originalCreateElement('canvas') as HTMLCanvasElement;
    const mock2d = createMock2DContext();
    mock2d.canvas = canvas;

    canvas.getContext = function (contextId: string, _options?: any) {
      if (contextId === '2d') return mock2d as any;
      if (contextId === 'webgl2') return createMockWebGLContext() as any;
      if (contextId === 'webgl' || contextId === 'experimental-webgl') return createMockWebGLContext() as any;
      return null;
    } as any;

    return canvas;
  }
  return originalCreateElement(tagName);
}) as any;

// Mock requestAnimationFrame
let rafId = 0;
(globalThis as any).requestAnimationFrame = (_cb: FrameRequestCallback) => {
  return ++rafId;
};
(globalThis as any).cancelAnimationFrame = (_id: number) => {};
