import { useEffect, useRef } from 'react';
import { useStore } from '@/state/store';
import { StudyReconstructor } from '@/features/dicom/study/StudyReconstructor';
import type { Volume } from '@/types';

export function useStudyPipeline() {
  const files = useStore((state) => state.files);
  const addVolume = useStore((state) => state.addVolume);
  const setActiveSeriesUID = useStore((state) => state.setActiveSeriesUID);
  const activeSeriesUID = useStore((state) => state.activeSeriesUID);
  const volumes = useStore((state) => state.volumes);

  const lastFileCount = useRef(0);

  useEffect(() => {
    if (files.length === 0 || files.length === lastFileCount.current) return;
    lastFileCount.current = files.length;

    const { ready } = StudyReconstructor.canReconstruct(files);
    if (!ready) return;

    try {
      const result = StudyReconstructor.reconstruct(files);

      for (const [seriesUID, volume] of result.volumes) {
        addVolume(seriesUID, volume);
        if (!activeSeriesUID) {
          setActiveSeriesUID(seriesUID);
        }
      }

      if (result.errors.length > 0) {
        console.warn('Volume reconstruction errors:', result.errors);
      }
    } catch (error) {
      console.error('Study reconstruction failed:', error);
    }
  }, [files, addVolume, setActiveSeriesUID, activeSeriesUID]);

  // Get active volume
  const activeVolume: Volume | null = activeSeriesUID
    ? volumes.get(activeSeriesUID) ?? null
    : null;

  const isSingleSlice = activeVolume !== null && activeVolume.dimensions.z <= 1;

  return { activeVolume, isSingleSlice };
}
