/**
 * Series catalog — the list of viewable series, grouped by study, derived from
 * loaded files + reconstructed volumes. Only series that have a reconstructed
 * volume are viewable, so the catalog is keyed off `volumes`; file metadata
 * enriches each entry (description, number, study grouping).
 *
 * Pure and shared by the Series picker and the compare per-pane selectors.
 */

import type { DicomFile, Volume } from '@/types';

export interface SeriesEntry {
  seriesInstanceUID: string;
  seriesNumber?: number;
  seriesDescription?: string;
  modality: string;
  sliceCount: number;
  studyInstanceUID: string;
}

export interface StudyGroup {
  studyInstanceUID: string;
  studyDate?: string;
  studyDescription?: string;
  patientName?: string;
  series: SeriesEntry[];
}

/**
 * Group viewable series by their real (per-file) study UID. Studies sort by
 * date (undated last); series sort by series number then UID for stability.
 */
export function buildSeriesCatalog(files: DicomFile[], volumes: Map<string, Volume>): StudyGroup[] {
  // First file seen per series carries the metadata we surface.
  const metaBySeries = new Map<string, DicomFile['metadata']>();
  for (const file of files) {
    const uid = file.metadata.seriesInstanceUID;
    if (!metaBySeries.has(uid)) metaBySeries.set(uid, file.metadata);
  }

  const groups = new Map<string, StudyGroup>();
  for (const [seriesUID, volume] of volumes) {
    const meta = metaBySeries.get(seriesUID);
    const studyUID = meta?.studyInstanceUID ?? 'unknown-study';

    let group = groups.get(studyUID);
    if (!group) {
      group = {
        studyInstanceUID: studyUID,
        studyDate: meta?.studyDate,
        studyDescription: meta?.studyDescription,
        patientName: meta?.patientName,
        series: [],
      };
      groups.set(studyUID, group);
    }

    group.series.push({
      seriesInstanceUID: seriesUID,
      seriesNumber: meta?.seriesNumber,
      seriesDescription: meta?.seriesDescription,
      modality: volume.modality,
      sliceCount: volume.dimensions.z,
      studyInstanceUID: studyUID,
    });
  }

  const sortKey = (d?: string) => d || '\uffff'; // undated sorts last
  const result = [...groups.values()].sort((a, b) =>
    sortKey(a.studyDate).localeCompare(sortKey(b.studyDate))
  );
  for (const group of result) {
    group.series.sort(
      (a, b) =>
        (a.seriesNumber ?? Infinity) - (b.seriesNumber ?? Infinity) ||
        a.seriesInstanceUID.localeCompare(b.seriesInstanceUID)
    );
  }
  return result;
}

/** Short label for a series, e.g. "#3 · T1 AXIAL · MR · 20 sl". */
export function seriesLabel(entry: SeriesEntry): string {
  const parts: string[] = [];
  if (entry.seriesNumber !== undefined) parts.push(`#${entry.seriesNumber}`);
  parts.push(entry.seriesDescription || 'Series');
  parts.push(entry.modality);
  parts.push(`${entry.sliceCount} sl`);
  return parts.join('  ·  ');
}
