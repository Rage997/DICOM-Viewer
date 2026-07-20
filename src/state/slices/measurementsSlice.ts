/**
 * Measurements slice — 2D-slice measurements and the active drawing tool.
 */

import { StateCreator } from 'zustand';
import type { Measurement, MeasurementTool, MeasurementPoint, SliceOrientation } from '@/types';

export interface MeasurementsState {
  measurements: Measurement[];
  activeTool: MeasurementTool | null;
  selectedMeasurementId: string | null;

  setActiveTool: (tool: MeasurementTool | null) => void;
  setSelectedMeasurement: (id: string | null) => void;
  addMeasurement: (measurement: Measurement) => void;
  updateMeasurementPoints: (id: string, points: MeasurementPoint[]) => void;
  updateMeasurementLabel: (id: string, label: string) => void;
  removeMeasurement: (id: string) => void;
  // Clear all, or just those on one slice when orientation+sliceIndex given.
  clearMeasurements: (scope?: { orientation: SliceOrientation; sliceIndex: number }) => void;
}

export const createMeasurementsSlice: StateCreator<MeasurementsState> = (set) => ({
  measurements: [],
  activeTool: null,
  selectedMeasurementId: null,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setSelectedMeasurement: (id) => set({ selectedMeasurementId: id }),

  addMeasurement: (measurement) =>
    set((state) => ({ measurements: [...state.measurements, measurement] })),

  updateMeasurementPoints: (id, points) =>
    set((state) => ({
      measurements: state.measurements.map((m) => (m.id === id ? { ...m, points } : m)),
    })),

  updateMeasurementLabel: (id, label) =>
    set((state) => ({
      // Empty label clears back to the computed value display.
      measurements: state.measurements.map((m) =>
        m.id === id ? { ...m, label: label.trim() || undefined } : m
      ),
    })),

  removeMeasurement: (id) =>
    set((state) => ({ measurements: state.measurements.filter((m) => m.id !== id) })),

  clearMeasurements: (scope) =>
    set((state) => ({
      measurements: scope
        ? state.measurements.filter(
            (m) => !(m.orientation === scope.orientation && m.sliceIndex === scope.sliceIndex)
          )
        : [],
    })),
});
