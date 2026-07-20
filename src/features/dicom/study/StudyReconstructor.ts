/**
 * Study Reconstructor - Orchestrates the complete study reconstruction pipeline
 */

import type { DicomFile, DicomStudy, Volume } from '@/types';
import { SeriesDetector } from './SeriesDetector';
import { VolumeBuilder } from './VolumeBuilder';

export interface ReconstructionResult {
  study: DicomStudy;
  volumes: Map<string, Volume>;
  errors: Array<{ seriesUID: string; error: Error }>;
}

/**
 * Orchestrates the complete study reconstruction pipeline
 */
export class StudyReconstructor {
  /**
   * Reconstruct complete study with volumes from DICOM files
   */
  static reconstruct(files: DicomFile[]): ReconstructionResult {
    if (files.length === 0) {
      throw new Error('Cannot reconstruct study from empty file list');
    }

    // Validate study consistency
    const validation = SeriesDetector.validateStudyConsistency(files);
    if (!validation.valid) {
      console.warn('Study consistency issues:', validation.errors);
    }

    // Build study structure
    const study = SeriesDetector.buildStudy(files);

    // Build volumes for each series
    const volumes = new Map<string, Volume>();
    const errors: Array<{ seriesUID: string; error: Error }> = [];

    for (const [seriesUID, series] of study.series) {
      try {
        const volume = VolumeBuilder.buildVolume(series);
        volumes.set(seriesUID, volume);

        // Volume built successfully
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({ seriesUID, error: err });
        console.error(`Failed to build volume for series ${seriesUID}:`, err);
      }
    }

    return {
      study,
      volumes,
      errors,
    };
  }

  /**
   * Check if files are ready for reconstruction
   */
  static canReconstruct(files: DicomFile[]): {
    ready: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    if (files.length === 0) {
      reasons.push('No files loaded');
      return { ready: false, reasons };
    }

    // Check if all files have required metadata
    const missingMetadata = files.filter(
      (f) =>
        f.metadata.rows === undefined ||
        f.metadata.columns === undefined ||
        f.metadata.seriesInstanceUID === undefined
    );

    if (missingMetadata.length > 0) {
      reasons.push(`${missingMetadata.length} files missing required metadata`);
    }

    // Note: files may span multiple studies (e.g. a prior+current pair loaded
    // for compare mode). That's supported — each series reconstructs into its
    // own volume regardless of study — so it does not block readiness.
    // reconstruct() still logs a consistency warning for genuinely mixed loads.

    return {
      ready: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Get reconstruction statistics
   */
  static getStats(result: ReconstructionResult): {
    studyCount: number;
    seriesCount: number;
    volumeCount: number;
    errorCount: number;
    totalSlices: number;
  } {
    return {
      studyCount: 1,
      seriesCount: result.study.series.size,
      volumeCount: result.volumes.size,
      errorCount: result.errors.length,
      totalSlices: result.study.totalInstances,
    };
  }
}
