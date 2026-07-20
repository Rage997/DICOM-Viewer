/**
 * Measurement export — flatten measurements to rows and serialize as CSV or
 * JSON for analysis. The row shape is the research deliverable: one row per
 * measurement with its physical value(s), units, and provenance (series,
 * orientation, slice). Pure builders (rows/CSV/JSON) are unit-tested; only the
 * download trigger touches the DOM.
 */

import type { Measurement, Volume } from '@/types';
import { measurementResult } from '@/features/viewer/measurements';

export interface MeasurementRow {
  id: string;
  label: string; // user-given name, or ''
  tool: string;
  series_uid: string;
  series_description: string;
  modality: string;
  orientation: string;
  slice: number; // 1-based, matches the UI
  value: number | ''; // primary value: distance / angle / ROI area
  value_unit: string; // mm | ° | mm²
  roi_mean: number | '';
  roi_std: number | '';
  roi_min: number | '';
  roi_max: number | '';
  roi_count: number | '';
  intensity_unit: string; // HU (CT) or ''
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const blankRound = (n: number | undefined): number | '' => (n === undefined ? '' : round4(n));

/** Flatten measurements to export rows. `seriesDescriptions` maps UID → label. */
export function measurementRows(
  measurements: Measurement[],
  volumes: Map<string, Volume>,
  seriesDescriptions: Map<string, string>
): MeasurementRow[] {
  const rows: MeasurementRow[] = [];
  for (const m of measurements) {
    const vol = volumes.get(m.seriesInstanceUID);
    if (!vol) continue;
    const r = measurementResult(m, vol);
    const primary = r.distanceMm ?? r.angleDeg ?? r.areaMm2;
    rows.push({
      id: m.id,
      label: m.label ?? '',
      tool: m.tool,
      series_uid: m.seriesInstanceUID,
      series_description: seriesDescriptions.get(m.seriesInstanceUID) ?? '',
      modality: vol.modality,
      orientation: m.orientation,
      slice: m.sliceIndex + 1,
      value: blankRound(primary),
      value_unit: r.valueUnit,
      roi_mean: blankRound(r.mean),
      roi_std: blankRound(r.std),
      roi_min: blankRound(r.min),
      roi_max: blankRound(r.max),
      roi_count: r.count ?? '',
      intensity_unit: r.intensityUnit ?? '',
    });
  }
  return rows;
}

const CSV_COLUMNS: (keyof MeasurementRow)[] = [
  'id', 'label', 'tool', 'series_uid', 'series_description', 'modality', 'orientation',
  'slice', 'value', 'value_unit', 'roi_mean', 'roi_std', 'roi_min', 'roi_max', 'roi_count', 'intensity_unit',
];

// Quote a field if it contains a comma, quote, or newline (RFC 4180).
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: MeasurementRow[]): string {
  const header = CSV_COLUMNS.join(',');
  const body = rows.map((row) => CSV_COLUMNS.map((c) => csvCell(row[c])).join(','));
  return [header, ...body].join('\n');
}

export function toJson(rows: MeasurementRow[]): string {
  return JSON.stringify(rows, null, 2);
}

/** Timestamped export filename, e.g. "measurements-2026-07-16_22-30-00.csv". */
export function measurementsFilename(format: 'csv' | 'json', date = new Date()): string {
  const ts = date.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
  return `measurements-${ts}.${format}`;
}

function triggerDownload(text: string, mime: string, filename: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Build rows and download them as CSV or JSON. Returns false if nothing to export. */
export function exportMeasurements(
  measurements: Measurement[],
  volumes: Map<string, Volume>,
  seriesDescriptions: Map<string, string>,
  format: 'csv' | 'json'
): boolean {
  const rows = measurementRows(measurements, volumes, seriesDescriptions);
  if (rows.length === 0) return false;
  if (format === 'csv') {
    triggerDownload(toCsv(rows), 'text/csv', measurementsFilename('csv'));
  } else {
    triggerDownload(toJson(rows), 'application/json', measurementsFilename('json'));
  }
  return true;
}
