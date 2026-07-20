/**
 * A single controlled pane in compare mode: a series picker header over a 2D
 * slice canvas (which carries its own measurement overlay + wheel/W-L drag) and
 * slice controls. Fully controlled by CompareView — holds no slice/W-L state of
 * its own, so scroll/W-L sync is driven entirely from the parent.
 */

import { SliceCanvas } from './SliceCanvas';
import { SliceControls } from './SliceControls';
import { seriesLabel, type StudyGroup } from '@/features/dicom/study';
import type { SliceOrientation, Volume } from '@/types';

interface ComparePaneProps {
  volume: Volume;
  orientation: SliceOrientation;
  sliceIndex: number;
  totalSlices: number;
  windowLevel: number;
  windowWidth: number;
  onSliceChange: (index: number) => void;
  onWindowLevelChange: (level: number, width: number) => void;
  catalog: StudyGroup[];
  seriesUID: string;
  onSeriesChange: (uid: string) => void;
}

export function ComparePane({
  volume,
  orientation,
  sliceIndex,
  totalSlices,
  windowLevel,
  windowWidth,
  onSliceChange,
  onWindowLevelChange,
  catalog,
  seriesUID,
  onSeriesChange,
}: ComparePaneProps) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-black">
      {/* Series picker + readouts */}
      <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-2 py-1">
        <select
          value={seriesUID}
          onChange={(e) => onSeriesChange(e.target.value)}
          className="min-w-0 flex-1 truncate rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 outline-none focus:ring-1 focus:ring-blue-500"
          title="Select series for this pane"
        >
          {catalog.map((group) => (
            <optgroup key={group.studyInstanceUID} label={group.studyDescription || group.studyDate || 'Study'}>
              {group.series.map((entry) => (
                <option key={entry.seriesInstanceUID} value={entry.seriesInstanceUID}>
                  {seriesLabel(entry)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className="shrink-0 font-mono text-[10px] text-neutral-500">
          W/L {Math.round(windowLevel)}/{Math.round(windowWidth)}
        </span>
      </div>

      {/* Slice canvas + controls */}
      <div className="relative min-h-0 flex-1">
        <SliceCanvas
          volume={volume}
          orientation={orientation}
          windowLevel={windowLevel}
          windowWidth={windowWidth}
          sliceIndex={sliceIndex}
          onWindowLevelChange={onWindowLevelChange}
          onSliceChange={onSliceChange}
        />
        <SliceControls
          currentSlice={sliceIndex}
          totalSlices={totalSlices}
          onSliceChange={onSliceChange}
        />
      </div>
    </div>
  );
}
