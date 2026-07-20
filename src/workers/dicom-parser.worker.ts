/**
 * DICOM Parser Web Worker
 * Parses DICOM files in background thread using dcmjs
 */

import * as dcmjs from 'dcmjs';
import type { DicomMetadata, DicomFile, Modality } from '@/types';
import { DicomError, DicomErrorCode } from '@/utils/errors/DicomError';
import {
  generateSyntheticStudyUID,
  generateSyntheticSeriesUID,
  generateSyntheticSOPUID,
} from '../utils/dicom/syntheticUIDs';

// Suppress dcmjs benign warnings globally in worker
// dcmjs logs warnings about non-standard DICOM formatting which are handled gracefully
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

console.warn = (...args: any[]) => {
  const message = args[0]?.toString() || '';
  // Only suppress known benign dcmjs warnings
  if (message.includes('Invalid length for fixed length tag') ||
      message.includes('Invalid vr type') ||
      message.includes('vr AS') ||
      message.includes('vr ox')) {
    return; // Suppress
  }
  // Pass through other warnings
  originalConsoleWarn.apply(console, args);
};

console.log = (...args: any[]) => {
  const message = args[0]?.toString() || '';
  // Suppress dcmjs verbose logging
  if (message.includes('Invalid length for fixed length tag') ||
      message.includes('Invalid vr type')) {
    return; // Suppress
  }
  // Pass through other logs
  originalConsoleLog.apply(console, args);
};

// Message types
interface ParseRequest {
  id: string;
  fileName: string;
  data: ArrayBuffer;
}

interface ParseSuccess {
  id: string;
  result: DicomFile;
}

interface ParseError {
  id: string;
  error: {
    code: string;
    message: string;
    file: string;
  };
}

/**
 * Extract metadata from DICOM dataset
 * Generates synthetic UIDs for missing required fields
 */
function extractMetadata(
  dataset: any,
  fileName: string,
  fileSize: number
): { metadata: DicomMetadata; warnings: string[] } {
  const warnings: string[] = [];

  // Helper to get value - tries both friendly name and hex tag
  const getValue = (friendlyName: string, hexTag?: string): any => {
    // Try friendly name first (from naturalized dataset)
    if (dataset[friendlyName] !== undefined && dataset[friendlyName] !== null) {
      return dataset[friendlyName];
    }
    // Fall back to hex tag
    if (hexTag && dataset[hexTag] !== undefined && dataset[hexTag] !== null) {
      return dataset[hexTag];
    }
    return undefined;
  };

  const getString = (friendlyName: string, hexTag?: string): string | undefined => {
    const value = getValue(friendlyName, hexTag);
    if (value === undefined || value === null) return undefined;
    return String(value).trim();
  };

  const getNumber = (friendlyName: string, hexTag?: string): number | undefined => {
    const value = getValue(friendlyName, hexTag);
    if (value === undefined || value === null) return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  };

  const getArray = (friendlyName: string, hexTag: string | undefined, length: number): number[] | undefined => {
    const value = getValue(friendlyName, hexTag);
    if (!value) return undefined;
    const arr = Array.isArray(value) ? value : [value];
    return arr.slice(0, length).map(Number);
  };

  // Extract metadata from DICOM dataset

  // Required tags - with synthetic UID fallback
  let studyInstanceUID = getString('StudyInstanceUID', '0020000D');
  let seriesInstanceUID = getString('SeriesInstanceUID', '0020000E');
  let sopInstanceUID = getString('SOPInstanceUID', '00080018');

  // Generate synthetic UIDs if missing
  if (!studyInstanceUID) {
    studyInstanceUID = generateSyntheticStudyUID(fileName);
    warnings.push('Missing StudyInstanceUID - generated synthetic UID');
    console.warn(`${fileName}: Missing StudyInstanceUID, using synthetic: ${studyInstanceUID}`);
  }

  if (!seriesInstanceUID) {
    seriesInstanceUID = generateSyntheticSeriesUID(fileName);
    warnings.push('Missing SeriesInstanceUID - generated synthetic UID');
    console.warn(`${fileName}: Missing SeriesInstanceUID, using synthetic: ${seriesInstanceUID}`);
  }

  if (!sopInstanceUID) {
    sopInstanceUID = generateSyntheticSOPUID(fileName, fileSize);
    warnings.push('Missing SOPInstanceUID - generated synthetic UID');
    console.warn(`${fileName}: Missing SOPInstanceUID, using synthetic: ${sopInstanceUID}`);
  }

  const modality = getString('Modality', '00080060');
  const rows = getNumber('Rows', '00280010');
  const columns = getNumber('Columns', '00280011');
  const bitsAllocated = getNumber('BitsAllocated', '00280100');
  const bitsStored = getNumber('BitsStored', '00280101');
  const pixelRepresentation = getNumber('PixelRepresentation', '00280103');
  const samplesPerPixel = getNumber('SamplesPerPixel', '00280002');
  const photometricInterpretation = getString('PhotometricInterpretation', '00280004');

  // Validate critical image properties (cannot be synthesized)
  if (!rows || !columns || !bitsAllocated) {
    // Try to identify what type of DICOM object this is
    const sopClassUID = getString('SOPClassUID', '00080016');
    const directoryRecordType = getString('DirectoryRecordType', '00041430');
    const modalityValue = getString('Modality', '00080060');

    // Check for print/film specific tags
    const imageDisplayFormat = getString('ImageDisplayFormat', '20100000');
    const filmOrientation = getString('FilmOrientation', '20500000');
    const borderDensity = dataset['BorderDensity'];
    const trim = dataset['Trim'];

    let objectType = 'Unknown DICOM object';
    let suggestion = 'This file does not contain image data.';

    // Identify common non-image DICOM types
    if (directoryRecordType) {
      objectType = 'DICOMDIR (Directory Index File)';
      suggestion = 'This is a directory index file, not an image. Look for numbered files (IM-0001-0001, etc.) in the same folder.';
    } else if (imageDisplayFormat || filmOrientation || borderDensity || trim) {
      objectType = 'DICOM Print/Film Configuration';
      suggestion = 'This file configures how images should be printed to medical film. Ask the doctor for the actual scan images (CT/MR/X-ray files), not the print settings.';
    } else if (sopClassUID?.includes('1.2.840.10008.5.1.4.1.1.88')) {
      objectType = 'Structured Report';
      suggestion = 'This is a text report, not an image.';
    } else if (sopClassUID?.includes('1.2.840.10008.5.1.4.1.1.11')) {
      objectType = 'Presentation State';
      suggestion = 'This is display settings data, not an image.';
    } else if (modalityValue === 'SR') {
      objectType = 'Structured Report';
      suggestion = 'This is a text report, not an image.';
    } else if (modalityValue === 'PR') {
      objectType = 'Presentation State';
      suggestion = 'This is display settings data, not an image.';
    }

    const foundTags = {
      objectType,
      rows: rows || '(missing)',
      columns: columns || '(missing)',
      bitsAllocated: bitsAllocated || '(missing)',
      sopClassUID: sopClassUID || '(not found)',
      directoryRecordType: directoryRecordType || '(not found)',
      modality: modalityValue || '(not found)',
      availableTagCount: Object.keys(dataset).length,
      sampleTags: Object.keys(dataset).slice(0, 20),
    };

    console.error(`${fileName}: Not an image file - ${objectType}`, foundTags);

    throw new DicomError(
      DicomErrorCode.MISSING_REQUIRED_TAGS,
      `Not a DICOM image file: ${objectType}. ${suggestion}`,
      {
        file: fileName,
        recoverable: false,
        context: foundTags,
      }
    );
  }

  // Log warnings for missing metadata
  if (warnings.length > 0) {
    console.warn(`${fileName}: File has ${warnings.length} warning(s):`, warnings);
  }

  // Build metadata object
  const metadata: DicomMetadata = {
    // Patient
    patientName: getString('PatientName', '00100010'),
    patientId: getString('PatientID', '00100020'),
    patientBirthDate: getString('PatientBirthDate', '00100030'),
    patientSex: getString('PatientSex', '00100040'),

    // Study
    studyInstanceUID,
    studyDate: getString('StudyDate', '00080020'),
    studyTime: getString('StudyTime', '00080030'),
    studyDescription: getString('StudyDescription', '00081030'),
    accessionNumber: getString('AccessionNumber', '00080050'),

    // Series
    seriesInstanceUID,
    seriesNumber: getNumber('SeriesNumber', '00200011'),
    seriesDescription: getString('SeriesDescription', '0008103E'),
    modality: (modality as Modality) || 'OT',

    // Instance
    sopInstanceUID,
    instanceNumber: getNumber('InstanceNumber', '00200013'),

    // Image properties
    rows,
    columns,
    bitsAllocated,
    bitsStored: bitsStored ?? bitsAllocated,
    pixelRepresentation: pixelRepresentation ?? 0,
    samplesPerPixel: samplesPerPixel ?? 1,
    photometricInterpretation: photometricInterpretation || 'MONOCHROME2',

    // Spatial information
    imagePositionPatient: getArray('ImagePositionPatient', '00200032', 3) as [number, number, number] | undefined,
    imageOrientationPatient: getArray('ImageOrientationPatient', '00200037', 6) as
      | [number, number, number, number, number, number]
      | undefined,
    pixelSpacing: getArray('PixelSpacing', '00280030', 2) as [number, number] | undefined,
    sliceThickness: getNumber('SliceThickness', '00180050'),
    sliceLocation: getNumber('SliceLocation', '00201041'),

    // Pixel value transformation
    rescaleSlope: getNumber('RescaleSlope', '00281053') ?? 1,
    rescaleIntercept: getNumber('RescaleIntercept', '00281052') ?? 0,
    windowCenter: getNumber('WindowCenter', '00281050'),
    windowWidth: getNumber('WindowWidth', '00281051'),

    // Transfer syntax
    transferSyntaxUID: getString('TransferSyntaxUID', '00020010'),
  };

  return { metadata, warnings };
}

/**
 * Validate DICOM file header (first 132 bytes)
 */
function validateDicomHeader(arrayBuffer: ArrayBuffer): boolean {
  if (arrayBuffer.byteLength < 132) {
    return false;
  }

  const view = new Uint8Array(arrayBuffer);

  // Check for DICOM prefix at bytes 128-131
  const dicm = String.fromCharCode(view[128]!, view[129]!, view[130]!, view[131]!);

  return dicm === 'DICM';
}

/**
 * Parse DICOM file
 */
function parseDicomFile(fileName: string, arrayBuffer: ArrayBuffer): DicomFile {
  try {
    // First, check if this looks like a DICOM file
    const hasDicomHeader = validateDicomHeader(arrayBuffer);

    if (!hasDicomHeader) {
      // Some DICOM files don't have the DICOM prefix (implicit VR)
      // Log warning but continue trying to parse
      console.warn(`${fileName}: No DICM header found, attempting parse anyway`);
    }

    // Parse with dcmjs
    let dicomData;
    let dataset;

    try {
      dicomData = dcmjs.data.DicomMessage.readFile(arrayBuffer);

      if (!dicomData || !dicomData.dict) {
        throw new DicomError(
          DicomErrorCode.PARSE_ERROR,
          'dcmjs returned empty or invalid data structure',
          {
            file: fileName,
            recoverable: false,
            context: {
              hasDicomHeader,
              dataKeys: dicomData ? Object.keys(dicomData) : [],
            }
          }
        );
      }

      // Naturalize dataset (convert to readable format)
      dataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);

      if (!dataset) {
        throw new DicomError(
          DicomErrorCode.PARSE_ERROR,
          'Failed to naturalize DICOM dataset',
          { file: fileName, recoverable: false }
        );
      }

    } catch (dcmjsError) {
      // dcmjs parsing failed
      throw new DicomError(
        DicomErrorCode.PARSE_ERROR,
        `dcmjs failed to parse file: ${dcmjsError instanceof Error ? dcmjsError.message : 'Unknown dcmjs error'}`,
        {
          file: fileName,
          recoverable: false,
          context: {
            hasDicomHeader,
            fileSize: arrayBuffer.byteLength,
            dcmjsError: dcmjsError instanceof Error ? dcmjsError.message : String(dcmjsError),
          },
          cause: dcmjsError instanceof Error ? dcmjsError : undefined,
        }
      );
    }

    // Extract metadata (may generate synthetic UIDs)
    const { metadata, warnings } = extractMetadata(dataset, fileName, arrayBuffer.byteLength);

    // Get pixel data
    const pixelDataElement = dicomData.dict['7FE00010'];
    if (!pixelDataElement) {
      throw new DicomError(
        DicomErrorCode.MISSING_REQUIRED_TAGS,
        'No pixel data found in DICOM file',
        {
          file: fileName,
          recoverable: false,
          context: {
            tagCount: Object.keys(dicomData.dict).length,
            hasPixelData: false,
          }
        }
      );
    }

    const pixelData = pixelDataElement.Value[0];

    return {
      metadata,
      pixelData,
      fileName,
      fileSize: arrayBuffer.byteLength,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    if (error instanceof DicomError) {
      throw error;
    }

    // Wrap unknown errors
    throw new DicomError(
      DicomErrorCode.PARSE_ERROR,
      `Failed to parse DICOM file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      {
        file: fileName,
        recoverable: true,
        cause: error instanceof Error ? error : undefined,
      }
    );
  }
}

/**
 * Worker message handler
 */
self.onmessage = (event: MessageEvent<ParseRequest>) => {
  const { id, fileName, data } = event.data;

  try {
    const result = parseDicomFile(fileName, data);

    const response: ParseSuccess = {
      id,
      result,
    };

    self.postMessage(response);
  } catch (error) {
    const response: ParseError = {
      id,
      error: {
        code: error instanceof DicomError ? error.code : DicomErrorCode.PARSE_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        file: fileName,
      },
    };

    self.postMessage(response);
  }
};

export type { ParseRequest, ParseSuccess, ParseError };
