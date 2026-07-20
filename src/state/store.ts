/**
 * Main Zustand store
 * Combines all slices
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createUISlice, type UIState } from './slices/uiSlice';
import { createStudySlice, type StudyState } from './slices/studySlice';
import { createSettingsSlice, type SettingsState } from './slices/settingsSlice';
import { createMeasurementsSlice, type MeasurementsState } from './slices/measurementsSlice';

// Combined store type
type StoreState = UIState & StudyState & SettingsState & MeasurementsState;

/**
 * Main application store
 */
export const useStore = create<StoreState>()(
  devtools(
    (...args) => ({
      ...createUISlice(...args),
      ...createStudySlice(...args),
      ...createSettingsSlice(...args),
      ...createMeasurementsSlice(...args),
    }),
    { name: 'DicomStore' }
  )
);

// Convenience selectors
export const useLoading = () => useStore((state) => state.isLoading);
export const useProgress = () => useStore((state) => state.progress);
export const useErrors = () => useStore((state) => state.errors);
export const useActiveSeriesUID = () => useStore((state) => state.activeSeriesUID);
export const useVolumes = () => useStore((state) => state.volumes);
