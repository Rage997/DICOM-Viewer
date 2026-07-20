/**
 * Series Detection - Groups DICOM files by series
 */

import type { DicomFile, DicomSeries, DicomStudy } from '@/types';

/**
 * Group DICOM files by SeriesInstanceUID
 */
export class SeriesDetector {
  /**
   * Detect and group series from DICOM files
   */
  static detectSeries(files: DicomFile[]): Map<string, DicomSeries> {
    const seriesMap = new Map<string, DicomSeries>();

    for (const file of files) {
      const seriesUID = file.metadata.seriesInstanceUID;

      if (!seriesMap.has(seriesUID)) {
        // Create new series
        seriesMap.set(seriesUID, {
          seriesInstanceUID: seriesUID,
          seriesNumber: file.metadata.seriesNumber,
          seriesDescription: file.metadata.seriesDescription,
          modality: file.metadata.modality,
          instances: [],
          instanceCount: 0,
          isComplete: false,
        });
      }

      // Add instance to series
      const series = seriesMap.get(seriesUID)!;
      series.instances.push(file);
      series.instanceCount = series.instances.length;
    }

    return seriesMap;
  }

  /**
   * Build complete study structure from files
   */
  static buildStudy(files: DicomFile[]): DicomStudy {
    if (files.length === 0) {
      throw new Error('Cannot build study from empty file list');
    }

    // Get study info from first file (all should have same study UID)
    const firstFile = files[0]!;
    const studyUID = firstFile.metadata.studyInstanceUID;

    // Group by series
    const seriesMap = this.detectSeries(files);

    // Build study
    const study: DicomStudy = {
      studyInstanceUID: studyUID,
      studyDate: firstFile.metadata.studyDate,
      studyDescription: firstFile.metadata.studyDescription,
      patientName: firstFile.metadata.patientName,
      patientId: firstFile.metadata.patientId,
      series: seriesMap,
      seriesCount: seriesMap.size,
      totalInstances: files.length,
    };

    return study;
  }

  /**
   * Validate that files belong to same study
   */
  static validateStudyConsistency(files: DicomFile[]): {
    valid: boolean;
    errors: string[];
  } {
    if (files.length === 0) {
      return { valid: true, errors: [] };
    }

    const errors: string[] = [];
    const firstStudyUID = files[0]!.metadata.studyInstanceUID;

    // Check all files have same study UID
    for (const file of files) {
      if (file.metadata.studyInstanceUID !== firstStudyUID) {
        errors.push(
          `File ${file.fileName} belongs to different study (${file.metadata.studyInstanceUID})`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get series statistics
   */
  static getSeriesStats(series: DicomSeries): {
    instanceCount: number;
    modality: string;
    hasSpatialInfo: boolean;
    hasPixelSpacing: boolean;
  } {
    const hasSpatialInfo = series.instances.some(
      (file) => file.metadata.imagePositionPatient !== undefined
    );

    const hasPixelSpacing = series.instances.some(
      (file) => file.metadata.pixelSpacing !== undefined
    );

    return {
      instanceCount: series.instances.length,
      modality: series.modality,
      hasSpatialInfo,
      hasPixelSpacing,
    };
  }
}
