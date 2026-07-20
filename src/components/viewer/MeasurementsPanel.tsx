/**
 * Measurements panel — a docked list of all measurements with their computed
 * values, grouped by series. Rename (inline), delete, jump-to, and CSV/JSON
 * export. This turns measurements from marks-on-pixels into a reviewable,
 * exportable worklist — the core of the research workflow.
 */

import { useMemo, useState } from 'react';
import { Target, Trash2, X, Pencil } from 'lucide-react';
import { useStore } from '@/state/store';
import { measurementResult } from '@/features/viewer/measurements';
import { buildSeriesCatalog, seriesLabel } from '@/features/dicom/study';
import { exportMeasurements } from '@/utils/measurementsExport';
import type { Measurement } from '@/types';

const TOOL_LABEL: Record<Measurement['tool'], string> = {
  distance: 'Distance',
  angle: 'Angle',
  roi: 'ROI',
};

interface MeasurementsPanelProps {
  onClose: () => void;
  onJumpTo: (m: Measurement) => void;
}

export function MeasurementsPanel({ onClose, onJumpTo }: MeasurementsPanelProps) {
  const measurements = useStore((s) => s.measurements);
  const volumes = useStore((s) => s.volumes);
  const files = useStore((s) => s.files);
  const selectedId = useStore((s) => s.selectedMeasurementId);
  const setSelected = useStore((s) => s.setSelectedMeasurement);
  const removeMeasurement = useStore((s) => s.removeMeasurement);
  const updateLabel = useStore((s) => s.updateMeasurementLabel);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const labelByUid = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of buildSeriesCatalog(files, volumes)) {
      for (const entry of group.series) map.set(entry.seriesInstanceUID, seriesLabel(entry));
    }
    return map;
  }, [files, volumes]);

  // Group measurements by series, preserving insertion order.
  const groups = useMemo(() => {
    const byUid = new Map<string, Measurement[]>();
    for (const m of measurements) {
      const list = byUid.get(m.seriesInstanceUID);
      if (list) list.push(m);
      else byUid.set(m.seriesInstanceUID, [m]);
    }
    return [...byUid.entries()];
  }, [measurements]);

  const commitEdit = (id: string) => {
    updateLabel(id, draft);
    setEditingId(null);
  };
  const handleExport = (format: 'csv' | 'json') => {
    const descriptions = new Map<string, string>();
    for (const group of buildSeriesCatalog(files, volumes)) {
      for (const entry of group.series) {
        descriptions.set(entry.seriesInstanceUID, entry.seriesDescription ?? '');
      }
    }
    exportMeasurements(measurements, volumes, descriptions, format);
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-neutral-800 bg-neutral-900">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2">
        <span className="text-sm font-medium text-neutral-200">
          Measurements
          {measurements.length > 0 && (
            <span className="ml-1.5 text-xs text-neutral-500">({measurements.length})</span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {measurements.length > 0 && (
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 transition-colors hover:bg-neutral-700"
              title="Export measurements as CSV"
            >
              CSV
            </button>
          )}
          {measurements.length > 0 && (
            <button
              type="button"
              onClick={() => handleExport('json')}
              className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 transition-colors hover:bg-neutral-700"
              title="Export measurements as JSON"
            >
              JSON
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            title="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {measurements.length === 0 ? (
          <p className="px-3 py-4 text-xs leading-relaxed text-neutral-500">
            No measurements yet. Pick a tool from the <span className="text-neutral-300">Measurements</span>{' '}
            menu, then click on a 2D view to place one.
          </p>
        ) : (
          groups.map(([uid, list]) => (
            <div key={uid} className="mb-1">
              <div className="truncate px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {labelByUid.get(uid) ?? 'Series'}
              </div>
              {list.map((m) => {
                const vol = volumes.get(m.seriesInstanceUID);
                const res = vol ? measurementResult(m, vol) : null;
                const selected = m.id === selectedId;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelected(m.id)}
                    className={`group cursor-pointer border-l-2 px-3 py-1.5 transition-colors ${
                      selected
                        ? 'border-blue-400 bg-neutral-800/60'
                        : 'border-transparent hover:bg-neutral-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm text-neutral-100">{res?.label ?? '—'}</span>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onJumpTo(m);
                          }}
                          className="rounded p-1 text-neutral-400 hover:bg-neutral-700 hover:text-blue-300"
                          title="Jump to this measurement"
                        >
                          <Target className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(m.id);
                            setDraft(m.label ?? '');
                          }}
                          className="rounded p-1 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
                          title="Rename"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMeasurement(m.id);
                          }}
                          className="rounded p-1 text-neutral-400 hover:bg-neutral-700 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {editingId === m.id ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={() => commitEdit(m.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(m.id);
                          else if (e.key === 'Escape') setEditingId(null);
                        }}
                        placeholder="Add a name…"
                        className="mt-1 w-full rounded bg-neutral-950 px-1.5 py-0.5 text-xs text-neutral-200 outline-none ring-1 ring-blue-500"
                      />
                    ) : (
                      m.label && <div className="mt-0.5 truncate text-xs text-neutral-300">{m.label}</div>
                    )}

                    <div className="mt-0.5 text-[11px] capitalize text-neutral-500">
                      {TOOL_LABEL[m.tool]} · {m.orientation} · slice {m.sliceIndex + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
