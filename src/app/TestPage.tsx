/**
 * Test page for automated rendering tests
 * Uses the full VolumeCanvas component (with OrbitControls) for realistic testing
 */

import { useMemo } from 'react';
import { VolumeCanvas } from '@/components/viewer/VolumeCanvas';
import type { Volume } from '@/types';

function createSyntheticVolume(): Volume {
  const dimensions = { x: 64, y: 64, z: 64 };
  const size = dimensions.x * dimensions.y * dimensions.z;
  const data = new Int16Array(size);

  for (let z = 0; z < dimensions.z; z++) {
    for (let y = 0; y < dimensions.y; y++) {
      for (let x = 0; x < dimensions.x; x++) {
        const index = x + y * dimensions.x + z * dimensions.x * dimensions.y;
        const value = (x / dimensions.x + y / dimensions.y + z / dimensions.z) * 333;
        data[index] = Math.floor(value);
      }
    }
  }

  return {
    seriesInstanceUID: 'test-synthetic-volume',
    modality: 'CT',
    dimensions,
    spacing: { x: 1, y: 1, z: 1 },
    origin: [0, 0, 0],
    orientation: {
      row: [1, 0, 0],
      column: [0, 1, 0],
      slice: [0, 0, 1],
    },
    data,
    dataRange: { min: 0, max: 999 },
    rescaleSlope: 1,
    rescaleIntercept: 0,
    windowLevel: 500,
    windowWidth: 999,
  };
}

export function TestPage() {
  const volume = useMemo(() => createSyntheticVolume(), []);

  return (
    <div className="flex h-screen flex-col bg-neutral-950">
      <div className="p-2 text-white text-xs">
        <span className="text-neutral-400">Test Page</span>
      </div>
      <div className="flex-1 relative">
        <VolumeCanvas volume={volume} />
      </div>
    </div>
  );
}
