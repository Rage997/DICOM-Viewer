/**
 * Core DICOM type definitions
 */

/**
 * Patient orientation in DICOM space (LPS coordinate system)
 * L: Left, P: Posterior, S: Superior
 */
export type PatientOrientation = 'LPS' | 'RAS';

/**
 * DICOM modality type
 */
export type Modality = 'CT' | 'MR' | 'PT' | 'US' | 'XA' | 'DX' | 'MG' | 'NM' | 'OT';

/**
 * DICOM transfer syntax
 */
export type TransferSyntax =
  | 'ImplicitVRLittleEndian'
  | 'ExplicitVRLittleEndian'
  | 'ExplicitVRBigEndian'
  | 'DeflatedExplicitVRLittleEndian'
  | 'JPEGBaseline'
  | 'JPEGLossless'
  | 'JPEG2000'
  | 'RLELossless';

/**
 * Raw DICOM file metadata extracted from tags
 */
export interface DicomMetadata {
  // Patient information
  patientName?: string;
  patientId?: string;
  patientBirthDate?: string;
  patientSex?: string;

  // Study information
  studyInstanceUID: string;
  studyDate?: string;
  studyTime?: string;
  studyDescription?: string;
  accessionNumber?: string;

  // Series information
  seriesInstanceUID: string;
  seriesNumber?: number;
  seriesDescription?: string;
  modality: Modality;

  // Instance information
  sopInstanceUID: string;
  instanceNumber?: number;

  // Image properties
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored: number;
  pixelRepresentation: number; // 0 = unsigned, 1 = signed
  samplesPerPixel: number;
  photometricInterpretation: string;

  // Spatial information
  imagePositionPatient?: [number, number, number]; // [x, y, z] in mm
  imageOrientationPatient?: [number, number, number, number, number, number]; // [row_x, row_y, row_z, col_x, col_y, col_z]
  pixelSpacing?: [number, number]; // [row, column] in mm
  sliceThickness?: number;
  sliceLocation?: number;

  // Pixel value transformation
  rescaleSlope?: number; // Default: 1
  rescaleIntercept?: number; // Default: 0
  windowCenter?: number | number[];
  windowWidth?: number | number[];

  // Transfer syntax
  transferSyntaxUID?: string;
}

/**
 * Parsed DICOM file with pixel data
 */
export interface DicomFile {
  metadata: DicomMetadata;
  pixelData: ArrayBuffer;
  fileName: string;
  fileSize: number;
  warnings?: string[]; // Warnings about missing/synthetic metadata
}

/**
 * DICOM series - collection of instances that belong together
 */
export interface DicomSeries {
  seriesInstanceUID: string;
  seriesNumber?: number;
  seriesDescription?: string;
  modality: Modality;
  instances: DicomFile[];

  // Computed properties
  instanceCount: number;
  isComplete: boolean; // All expected instances present
}

/**
 * DICOM study - collection of series for a single patient exam
 */
export interface DicomStudy {
  studyInstanceUID: string;
  studyDate?: string;
  studyDescription?: string;
  patientName?: string;
  patientId?: string;

  series: Map<string, DicomSeries>;

  // Computed properties
  seriesCount: number;
  totalInstances: number;
}

/**
 * 3D volume reconstructed from DICOM series
 */
export interface Volume {
  // Source data
  seriesInstanceUID: string;
  modality: Modality;

  // Volume dimensions
  dimensions: {
    x: number; // columns
    y: number; // rows
    z: number; // slices
  };

  // Voxel spacing in mm
  spacing: {
    x: number; // column spacing
    y: number; // row spacing
    z: number; // slice spacing
  };

  // Origin point in patient coordinate system (mm)
  origin: [number, number, number];

  // Orientation matrix (row direction, column direction, slice direction)
  orientation: {
    row: [number, number, number];
    column: [number, number, number];
    slice: [number, number, number];
  };

  // Pixel data (Hounsfield Units for CT, arbitrary for MR)
  // Int16Array for CT (signed), Uint16Array for most MR (unsigned)
  data: Int16Array | Uint16Array;

  // Value range in the data
  dataRange: {
    min: number;
    max: number;
  };

  // Rescale parameters (applied to raw data)
  rescaleSlope: number;
  rescaleIntercept: number;

  // Recommended window level/width for display
  windowLevel?: number;
  windowWidth?: number;
}

/**
 * Slice orientation for 2D views
 */
export type SliceOrientation = 'axial' | 'sagittal' | 'coronal';

/**
 * Window/Level preset for common tissue types
 */
export interface WindowLevelPreset {
  name: string;
  windowLevel: number; // Center (Hounsfield Units for CT)
  windowWidth: number; // Width (Hounsfield Units for CT)
  description?: string;
}

/**
 * Standard window/level presets for CT
 */
export const CT_PRESETS = {
  abdomen: {
    name: 'Abdomen',
    windowLevel: 60,
    windowWidth: 400,
    description: 'Soft tissue in abdomen',
  },
  lung: {
    name: 'Lung',
    windowLevel: -600,
    windowWidth: 1500,
    description: 'Pulmonary parenchyma',
  },
  bone: {
    name: 'Bone',
    windowLevel: 300,
    windowWidth: 1500,
    description: 'Skeletal structures',
  },
  brain: {
    name: 'Brain',
    windowLevel: 40,
    windowWidth: 80,
    description: 'Brain parenchyma',
  },
  liver: {
    name: 'Liver',
    windowLevel: 80,
    windowWidth: 150,
    description: 'Liver parenchyma',
  },
  spine: {
    name: 'Spine',
    windowLevel: 50,
    windowWidth: 250,
    description: 'Spinal structures',
  },
} satisfies Record<string, WindowLevelPreset>;
