import { describe, it, expect } from 'vitest';
import type { Measurement, Volume } from '@/types';
import { measurementRows, toCsv, toJson, measurementsFilename } from './measurementsExport';

function vol(seriesInstanceUID: string, modality: Volume['modality'] = 'CT'): Volume {
  const data = new Int16Array(4 * 4 * 4);
  for (let i = 0; i < data.length; i++) data[i] = i;
  return {
    seriesInstanceUID,
    modality,
    dimensions: { x: 4, y: 4, z: 4 },
    spacing: { x: 1, y: 2, z: 3 },
    origin: [0, 0, 0],
    orientation: { row: [1, 0, 0], column: [0, 1, 0], slice: [0, 0, 1] },
    data,
    dataRange: { min: 0, max: 63 },
    rescaleSlope: 1,
    rescaleIntercept: 0,
  };
}

const volumes = new Map([['s1', vol('s1')]]);
const descriptions = new Map([['s1', 'T1 AXIAL']]);

const distance: Measurement = {
  id: 'd1', seriesInstanceUID: 's1', tool: 'distance', orientation: 'axial', sliceIndex: 0,
  points: [{ x: 0, y: 0 }, { x: 3, y: 2 }], label: 'lesion A',
};
const roi: Measurement = {
  id: 'r1', seriesInstanceUID: 's1', tool: 'roi', orientation: 'axial', sliceIndex: 2,
  points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
};

describe('measurementRows', () => {
  it('flattens distance with value, unit, provenance, 1-based slice', () => {
    const [row] = measurementRows([distance], volumes, descriptions);
    expect(row).toMatchObject({
      id: 'd1',
      label: 'lesion A',
      tool: 'distance',
      series_uid: 's1',
      series_description: 'T1 AXIAL',
      modality: 'CT',
      orientation: 'axial',
      slice: 1, // 0-based index 0 → 1-based
      value: 5, // dx=3*1, dy=2*2=4 → 5mm
      value_unit: 'mm',
      roi_mean: '', // not an ROI
      intensity_unit: '', // distance has no intensity stats
    });
  });

  it('fills ROI stat columns for ROI measurements', () => {
    const row = measurementRows([roi], volumes, descriptions)[0]!;
    expect(row.value_unit).toBe('mm²');
    expect(row.value).toBeCloseTo(2);
    expect(row.roi_mean).toBeCloseTo(34.5); // z=2 slice: (32+33+36+37)/4
    expect(row.roi_count).toBe(4);
    expect(row.slice).toBe(3);
  });

  it('skips measurements whose volume is not loaded', () => {
    const orphan: Measurement = { ...distance, id: 'x', seriesInstanceUID: 'gone' };
    expect(measurementRows([orphan], volumes, descriptions)).toHaveLength(0);
  });
});

describe('toCsv', () => {
  it('emits a header + one row per measurement, quoting risky fields', () => {
    const rows = measurementRows(
      [{ ...distance, label: 'has, comma' }],
      volumes,
      descriptions
    );
    const csv = toCsv(rows);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'id,label,tool,series_uid,series_description,modality,orientation,slice,value,value_unit,roi_mean,roi_std,roi_min,roi_max,roi_count,intensity_unit'
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"has, comma"'); // comma-containing label quoted
    expect(lines[1]).toContain(',5,mm,'); // value + unit
  });
});

describe('toJson', () => {
  it('is valid JSON round-tripping the rows', () => {
    const rows = measurementRows([distance, roi], volumes, descriptions);
    const parsed = JSON.parse(toJson(rows));
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe('d1');
    expect(parsed[1].tool).toBe('roi');
  });
});

describe('measurementsFilename', () => {
  it('is timestamped with the right extension', () => {
    const date = new Date('2026-07-16T22:30:05.123Z');
    expect(measurementsFilename('csv', date)).toBe('measurements-2026-07-16_22-30-05.csv');
    expect(measurementsFilename('json', date)).toBe('measurements-2026-07-16_22-30-05.json');
  });
});
