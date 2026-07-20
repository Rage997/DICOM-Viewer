import { describe, it, expect } from 'vitest';
import type { DicomFile, Volume } from '@/types';
import { buildSeriesCatalog, seriesLabel } from './seriesCatalog';

function file(seriesUID: string, overrides: Partial<DicomFile['metadata']> = {}): DicomFile {
  return {
    metadata: {
      studyInstanceUID: 'study-A',
      seriesInstanceUID: seriesUID,
      sopInstanceUID: `sop-${seriesUID}`,
      modality: 'MR',
      rows: 4,
      columns: 4,
      bitsAllocated: 16,
      bitsStored: 16,
      pixelRepresentation: 0,
      samplesPerPixel: 1,
      photometricInterpretation: 'MONOCHROME2',
      ...overrides,
    },
    pixelData: new ArrayBuffer(0),
    fileName: `${seriesUID}.dcm`,
    fileSize: 0,
  };
}

function volume(seriesUID: string, z: number, modality: Volume['modality'] = 'MR'): Volume {
  return {
    seriesInstanceUID: seriesUID,
    modality,
    dimensions: { x: 4, y: 4, z },
    spacing: { x: 1, y: 1, z: 1 },
    origin: [0, 0, 0],
    orientation: { row: [1, 0, 0], column: [0, 1, 0], slice: [0, 0, 1] },
    data: new Int16Array(0),
    dataRange: { min: 0, max: 1 },
    rescaleSlope: 1,
    rescaleIntercept: 0,
  };
}

describe('buildSeriesCatalog', () => {
  it('groups viewable series by study, enriched from file metadata', () => {
    const files = [
      file('s1', { studyInstanceUID: 'study-A', studyDate: '20240101', seriesNumber: 2, seriesDescription: 'T2' }),
      file('s2', { studyInstanceUID: 'study-A', studyDate: '20240101', seriesNumber: 1, seriesDescription: 'T1' }),
      file('s3', { studyInstanceUID: 'study-B', studyDate: '20230601', seriesDescription: 'PRIOR' }),
    ];
    const volumes = new Map([
      ['s1', volume('s1', 20)],
      ['s2', volume('s2', 24)],
      ['s3', volume('s3', 10)],
    ]);

    const catalog = buildSeriesCatalog(files, volumes);

    // Studies sorted by date ascending: study-B (2023) before study-A (2024).
    expect(catalog.map((g) => g.studyInstanceUID)).toEqual(['study-B', 'study-A']);
    // Series within study-A sorted by series number: T1 (#1) before T2 (#2).
    const studyA = catalog.find((g) => g.studyInstanceUID === 'study-A')!;
    expect(studyA.series.map((s) => s.seriesDescription)).toEqual(['T1', 'T2']);
    expect(studyA.series[0]!.sliceCount).toBe(24);
  });

  it('only lists series that have a reconstructed volume', () => {
    const files = [file('s1'), file('s2')];
    const volumes = new Map([['s1', volume('s1', 5)]]); // s2 has no volume
    const catalog = buildSeriesCatalog(files, volumes);
    const uids = catalog.flatMap((g) => g.series.map((s) => s.seriesInstanceUID));
    expect(uids).toEqual(['s1']);
  });

  it('falls back to a synthetic study for series with no file metadata', () => {
    const catalog = buildSeriesCatalog([], new Map([['orphan', volume('orphan', 3)]]));
    expect(catalog).toHaveLength(1);
    expect(catalog[0]!.studyInstanceUID).toBe('unknown-study');
    expect(catalog[0]!.series[0]!.sliceCount).toBe(3);
  });
});

describe('seriesLabel', () => {
  it('formats number, description, modality, slice count', () => {
    expect(
      seriesLabel({
        seriesInstanceUID: 's1',
        seriesNumber: 3,
        seriesDescription: 'T1 AXIAL',
        modality: 'MR',
        sliceCount: 20,
        studyInstanceUID: 'study-A',
      })
    ).toBe('#3  ·  T1 AXIAL  ·  MR  ·  20 sl');
  });

  it('falls back to "Series" when description is missing', () => {
    expect(
      seriesLabel({ seriesInstanceUID: 's1', modality: 'CT', sliceCount: 5, studyInstanceUID: 'x' })
    ).toBe('Series  ·  CT  ·  5 sl');
  });
});
