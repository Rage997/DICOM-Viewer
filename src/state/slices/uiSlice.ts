/**
 * UI state slice - loading, errors, progress
 */

import { StateCreator } from 'zustand';
import type { SliceOrientation } from '@/types';

/** A one-shot request to navigate a viewport to a specific series+slice. */
export interface FocusTarget {
  seriesInstanceUID: string;
  orientation: SliceOrientation;
  sliceIndex: number;
}

export interface LoadingProgress {
  stage: 'downloading' | 'validating' | 'parsing' | 'reconstructing' | 'complete';
  current: number;
  total: number;
  message: string;
}

export interface ErrorInfo {
  id: string;
  code: string;
  message: string;
  file?: string;
  recoverable: boolean;
  timestamp: Date;
}

export interface UIState {
  // Loading state
  isLoading: boolean;
  progress: LoadingProgress | null;

  // Errors
  errors: ErrorInfo[];
  skippedFiles: string[];

  // Active panels
  activePanel: 'metadata' | 'settings' | null;

  // Pending jump-to-measurement navigation; consumed by the target viewport.
  focusTarget: FocusTarget | null;

  // Grayscale invert for all 2D slice views (toggle with 'I').
  invert2d: boolean;

  // Actions
  setLoading: (loading: boolean) => void;
  setProgress: (progress: LoadingProgress | null) => void;
  addError: (error: ErrorInfo) => void;
  clearErrors: () => void;
  skipFile: (filename: string) => void;
  setActivePanel: (panel: 'metadata' | 'settings' | null) => void;
  setFocusTarget: (target: FocusTarget | null) => void;
  toggleInvert2d: () => void;
}

export const createUISlice: StateCreator<UIState> = (set) => ({
  isLoading: false,
  progress: null,
  errors: [],
  skippedFiles: [],
  activePanel: null,
  focusTarget: null,
  invert2d: false,

  setLoading: (loading) => set({ isLoading: loading }),

  setProgress: (progress) => set({ progress }),

  addError: (error) =>
    set((state) => ({
      errors: [...state.errors, error],
    })),

  clearErrors: () => set({ errors: [] }),

  skipFile: (filename) =>
    set((state) => ({
      skippedFiles: [...state.skippedFiles, filename],
    })),

  setActivePanel: (panel) => set({ activePanel: panel }),
  setFocusTarget: (target) => set({ focusTarget: target }),
  toggleInvert2d: () => set((state) => ({ invert2d: !state.invert2d })),
});
