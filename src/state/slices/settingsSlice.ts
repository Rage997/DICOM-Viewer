/**
 * Settings slice — application settings surfaced in the toolbar Settings panel.
 * Currently holds 3D volume rendering settings; the home for future settings.
 */

import { StateCreator } from 'zustand';
import type { VolumeRenderSettings } from '@/features/viewer/volume/VolumeRenderer';

export const DEFAULT_VOLUME_SETTINGS: VolumeRenderSettings = {
  windowLevel: 2000,
  windowWidth: 4000,
  opacity: 1.0, // smoothstep transfer gates tissue; slider lowers if needed
  stepSize: 0.005, // reference sampling distance for opacity correction
  maxSteps: 384, // more samples → smoother volume (early-terminates when opaque)
  renderMode: 'composite',
  colorMap: 'grayscale',
  clipEnabled: false,
  clipMin: [0, 0, 0],
  clipMax: [1, 1, 1],
};

export interface SettingsState {
  volumeSettings: VolumeRenderSettings;
  // Series UID whose window/level has been seeded, so a viewport remount (e.g. a
  // layout change) doesn't reset the user's edits for the same volume.
  seededVolumeUID: string | null;
  // Merge a partial update (live edits from the Settings panel).
  setVolumeSettings: (partial: Partial<VolumeRenderSettings>) => void;
  // Seed settings for a volume the first time it loads; a no-op on later calls
  // for the same UID (preserves edits across remounts).
  seedVolumeSettings: (seriesUID: string, settings: VolumeRenderSettings) => void;
}

export const createSettingsSlice: StateCreator<SettingsState> = (set) => ({
  volumeSettings: DEFAULT_VOLUME_SETTINGS,
  seededVolumeUID: null,
  setVolumeSettings: (partial) =>
    set((state) => ({ volumeSettings: { ...state.volumeSettings, ...partial } })),
  seedVolumeSettings: (seriesUID, settings) =>
    set((state) =>
      state.seededVolumeUID === seriesUID
        ? {}
        : { volumeSettings: settings, seededVolumeUID: seriesUID }
    ),
});
