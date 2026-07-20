/**
 * Study state slice - DICOM studies, series, volumes
 */

import { StateCreator } from 'zustand';
import type { DicomStudy, DicomFile, Volume } from '@/types';

export interface StudyState {
  // Loaded studies
  studies: Map<string, DicomStudy>;

  // Active series for viewing
  activeSeriesUID: string | null;

  // Parsed DICOM files (before reconstruction)
  files: DicomFile[];

  // Reconstructed volumes
  volumes: Map<string, Volume>;

  // Actions
  addFiles: (files: DicomFile[]) => void;
  setStudies: (studies: Map<string, DicomStudy>) => void;
  setActiveSeriesUID: (uid: string | null) => void;
  addVolume: (seriesUID: string, volume: Volume) => void;
  clearAll: () => void;
}

export const createStudySlice: StateCreator<StudyState> = (set) => ({
  studies: new Map(),
  activeSeriesUID: null,
  files: [],
  volumes: new Map(),

  addFiles: (files) =>
    set((state) => ({
      files: [...state.files, ...files],
    })),

  setStudies: (studies) => set({ studies }),

  setActiveSeriesUID: (uid) => set({ activeSeriesUID: uid }),

  addVolume: (seriesUID, volume) =>
    set((state) => {
      const volumes = new Map(state.volumes);
      volumes.set(seriesUID, volume);
      return { volumes };
    }),

  clearAll: () =>
    set({
      studies: new Map(),
      activeSeriesUID: null,
      files: [],
      volumes: new Map(),
    }),
});
