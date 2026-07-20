/**
 * Compare mode: two series side by side sharing one orientation, for
 * prior-vs-current style review. Owns all compare state (right-pane series,
 * orientation, per-side slice + W/L, sync toggles); the panes are controlled.
 *
 * Scroll sync maps by fraction of stack (proportional), so two series of
 * different slice counts stay aligned. W/L sync is opt-in and off by default
 * (different series usually want different windows). 2D only — 3D compare is
 * out of scope for this version.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import { ComparePane } from './ComparePane';
import { buildSeriesCatalog } from '@/features/dicom/study';
import { sliceCountFor, mapSliceProportional } from '@/features/viewer/compareSync';
import type { DicomFile, SliceOrientation, Volume } from '@/types';

interface CompareViewProps {
  volumes: Map<string, Volume>;
  files: DicomFile[];
  leftSeriesUID: string;
  onLeftSeriesChange: (uid: string) => void;
}

const ORIENTATIONS: SliceOrientation[] = ['axial', 'sagittal', 'coronal'];

const wlOf = (v: Volume) => ({ level: v.windowLevel ?? 40, width: v.windowWidth ?? 400 });
const mid = (total: number) => (total > 0 ? Math.floor(total / 2) : 0);
const clampSlice = (i: number, total: number) => Math.max(0, Math.min(i, total - 1));

export function CompareView({ volumes, files, leftSeriesUID, onLeftSeriesChange }: CompareViewProps) {
  const catalog = useMemo(() => buildSeriesCatalog(files, volumes), [files, volumes]);

  // Right pane defaults to the first series that isn't the left one.
  const [rightSeriesUID, setRightSeriesUID] = useState(() => {
    const all = catalog.flatMap((g) => g.series.map((s) => s.seriesInstanceUID));
    return all.find((uid) => uid !== leftSeriesUID) ?? leftSeriesUID;
  });

  const [orientation, setOrientation] = useState<SliceOrientation>('axial');
  const [syncScroll, setSyncScroll] = useState(true);
  const [syncWL, setSyncWL] = useState(false);

  const [leftSlice, setLeftSlice] = useState(0);
  const [rightSlice, setRightSlice] = useState(0);
  const [leftWL, setLeftWL] = useState({ level: 40, width: 400 });
  const [rightWL, setRightWL] = useState({ level: 40, width: 400 });

  const leftVolume = volumes.get(leftSeriesUID) ?? null;
  const rightVolume = volumes.get(rightSeriesUID) ?? null;
  const leftTotal = leftVolume ? sliceCountFor(leftVolume, orientation) : 0;
  const rightTotal = rightVolume ? sliceCountFor(rightVolume, orientation) : 0;

  // Seed each side (center slice + volume's default W/L) when its series or the
  // shared orientation changes. Parent owns the state; panes are controlled.
  useEffect(() => {
    if (!leftVolume) return;
    setLeftSlice(mid(sliceCountFor(leftVolume, orientation)));
    setLeftWL(wlOf(leftVolume));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftSeriesUID, orientation]);

  useEffect(() => {
    if (!rightVolume) return;
    setRightSlice(mid(sliceCountFor(rightVolume, orientation)));
    setRightWL(wlOf(rightVolume));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightSeriesUID, orientation]);

  if (!leftVolume || !rightVolume) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-500">
        Load a second series to compare.
      </div>
    );
  }

  const handleLeftSlice = (i: number) => {
    const clamped = clampSlice(i, leftTotal);
    setLeftSlice(clamped);
    if (syncScroll) setRightSlice(mapSliceProportional(clamped, leftTotal, rightTotal));
  };
  const handleRightSlice = (i: number) => {
    const clamped = clampSlice(i, rightTotal);
    setRightSlice(clamped);
    if (syncScroll) setLeftSlice(mapSliceProportional(clamped, rightTotal, leftTotal));
  };
  const handleLeftWL = (level: number, width: number) => {
    setLeftWL({ level, width });
    if (syncWL) setRightWL({ level, width });
  };
  const handleRightWL = (level: number, width: number) => {
    setRightWL({ level, width });
    if (syncWL) setLeftWL({ level, width });
  };

  const toggleSyncScroll = () => {
    const next = !syncScroll;
    setSyncScroll(next);
    if (next) setRightSlice(mapSliceProportional(leftSlice, leftTotal, rightTotal));
  };
  const toggleSyncWL = () => {
    const next = !syncWL;
    setSyncWL(next);
    if (next) setRightWL(leftWL);
  };

  return (
    <div className="flex h-full w-full flex-col bg-neutral-950">
      {/* Shared controls: orientation + sync toggles */}
      <div className="flex items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-3 py-1.5">
        <div className="flex gap-1">
          {ORIENTATIONS.map((o) => (
            <button
              key={o}
              onClick={() => setOrientation(o)}
              className={`rounded px-2 py-1 text-xs capitalize transition-colors ${
                orientation === o
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
              }`}
            >
              {o}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-1">
          <SyncToggle label="Link scroll" active={syncScroll} onClick={toggleSyncScroll} />
          <SyncToggle label="Link W/L" active={syncWL} onClick={toggleSyncWL} />
        </div>
      </div>

      {/* Two panes */}
      <div className="flex min-h-0 flex-1 gap-[2px]">
        <ComparePane
          volume={leftVolume}
          orientation={orientation}
          sliceIndex={leftSlice}
          totalSlices={leftTotal}
          windowLevel={leftWL.level}
          windowWidth={leftWL.width}
          onSliceChange={handleLeftSlice}
          onWindowLevelChange={handleLeftWL}
          catalog={catalog}
          seriesUID={leftSeriesUID}
          onSeriesChange={onLeftSeriesChange}
        />
        <ComparePane
          volume={rightVolume}
          orientation={orientation}
          sliceIndex={rightSlice}
          totalSlices={rightTotal}
          windowLevel={rightWL.level}
          windowWidth={rightWL.width}
          onSliceChange={handleRightSlice}
          onWindowLevelChange={handleRightWL}
          catalog={catalog}
          seriesUID={rightSeriesUID}
          onSeriesChange={setRightSeriesUID}
        />
      </div>
    </div>
  );
}

function SyncToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
      }`}
      title={`${active ? 'Unlink' : 'Link'} ${label}`}
    >
      <Link2 className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
