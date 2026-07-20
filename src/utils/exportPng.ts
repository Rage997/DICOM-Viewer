/**
 * Export viewports to PNG. Two paths share `renderPaneToCanvas` (base image +
 * measurement overlay + burned-in caption):
 *  - `exportViewportPng`  — the active pane.
 *  - `exportCollagePng`   — all mounted panes tiled, with a clinical info band.
 * DOM-scoped by the `data-viewport` attribute, so no canvas refs thread up the tree.
 */

import type { ViewportOrientation } from '@/types';

const ORIENTATION_LABEL: Record<ViewportOrientation, string> = {
  axial: 'Axial',
  sagittal: 'Sagittal',
  coronal: 'Coronal',
  '3d': '3D',
};

// Canonical pane order for the collage grid.
const ORIENTATION_ORDER: ViewportOrientation[] = ['axial', 'sagittal', 'coronal', '3d'];

export interface CaptionInfo {
  orientation: ViewportOrientation;
  windowLevel?: number;
  windowWidth?: number;
  slice?: { index: number; total: number } | null;
}

/** Study/patient metadata for the collage info band. */
export interface StudyInfo {
  patientName?: string;
  patientId?: string;
  patientSex?: string;
  patientBirthDate?: string;
  studyDate?: string;
  studyDescription?: string;
  modality?: string;
  dimensions?: { x: number; y: number; z: number };
  spacing?: { x: number; y: number; z: number };
  windowLevel?: number;
  windowWidth?: number;
}

/** Timestamped, tagged filename, e.g. "dicom-axial-2026-07-16_22-30-00.png". */
export function exportFilename(tag: string, date = new Date()): string {
  const ts = date.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
  return `dicom-${tag}-${ts}.png`;
}

/** Human caption burned into the export, e.g. "Axial · Slice 7/20 · W/L 40/400". */
export function buildCaption(info: CaptionInfo): string {
  const parts: string[] = [ORIENTATION_LABEL[info.orientation]];
  if (info.slice) parts.push(`Slice ${info.slice.index}/${info.slice.total}`);
  if (info.windowLevel !== undefined && info.windowWidth !== undefined) {
    parts.push(`W/L ${Math.round(info.windowLevel)}/${Math.round(info.windowWidth)}`);
  }
  return parts.join('  ·  ');
}

// "YYYYMMDD" (DICOM DA) -> "YYYY-MM-DD"; anything else passes through.
function formatDicomDate(value: string | undefined): string | undefined {
  if (value && /^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return value || undefined;
}

// Trim a spacing value to at most 2 decimals without trailing zeros.
function fmtMm(value: number): string {
  return String(Number(value.toFixed(2)));
}

/**
 * Two-line clinical info band for the collage. Line 1 is patient identity
 * (dropped when `anonymize`, keeping only sex); line 2 is study/technical detail
 * shown in both modes. Missing fields are omitted.
 */
export function buildStudyInfo(info: StudyInfo, opts: { anonymize: boolean }): string[] {
  const identity: string[] = [];
  if (opts.anonymize) {
    identity.push('De-identified');
    if (info.patientSex) identity.push(info.patientSex);
  } else {
    identity.push(info.patientName || 'Unknown patient');
    if (info.patientId) identity.push(`ID ${info.patientId}`);
    if (info.patientSex) identity.push(info.patientSex);
    const dob = formatDicomDate(info.patientBirthDate);
    if (dob) identity.push(`DOB ${dob}`);
  }

  const technical: string[] = [];
  const studyDate = formatDicomDate(info.studyDate);
  if (studyDate) technical.push(studyDate);
  if (info.modality) technical.push(info.modality);
  if (info.studyDescription) technical.push(info.studyDescription);
  if (info.dimensions) {
    technical.push(`${info.dimensions.x}×${info.dimensions.y}×${info.dimensions.z}`);
  }
  if (info.spacing) {
    technical.push(`${fmtMm(info.spacing.x)}×${fmtMm(info.spacing.y)}×${fmtMm(info.spacing.z)} mm`);
  }
  if (info.windowLevel !== undefined && info.windowWidth !== undefined) {
    technical.push(`W/L ${Math.round(info.windowLevel)}/${Math.round(info.windowWidth)}`);
  }

  return [identity.join('  ·  '), technical.join('  ·  ')];
}

function parseSlice(value: string | undefined): { index: number; total: number } | null {
  if (!value) return null;
  const [index, total] = value.split('/').map(Number);
  return index && total ? { index, total } : null;
}

// Rasterize an SVG element onto the 2D context at the export size.
async function drawSvgOverlay(
  ctx: CanvasRenderingContext2D,
  svg: SVGElement,
  w: number,
  h: number
): Promise<void> {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const xml = new XMLSerializer().serializeToString(clone);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);

  const { promise, resolve } = Promise.withResolvers<void>();
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, w, h);
    resolve();
  };
  img.onerror = () => resolve(); // best-effort: skip the overlay if it fails
  img.src = url;
  return promise;
}

function drawCaption(ctx: CanvasRenderingContext2D, text: string, w: number, h: number): void {
  const fontSize = Math.max(12, Math.round(h * 0.028));
  ctx.font = `${fontSize}px monospace`;
  const padX = fontSize * 0.6;
  const boxH = fontSize * 2;
  const textW = Math.min(w, ctx.measureText(text).width + padX * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, h - boxH, textW, boxH);
  ctx.fillStyle = '#e5e5e5';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, padX, h - boxH / 2);
}

function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Composite one pane: base canvas -> measurement overlay -> caption. Returns the
// rendered canvas (not a data URL) so the collage can tile it. Null if the pane
// has no drawable canvas.
async function renderPaneToCanvas(
  pane: HTMLElement,
  caption: string
): Promise<HTMLCanvasElement | null> {
  const source = pane.querySelector('canvas');
  if (!source) return null;

  const w = source.width;
  const h = source.height;
  if (w === 0 || h === 0) return null;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(source, 0, 0, w, h);

  // Composite the measurement overlay only (never the toolbar/control icons).
  const overlay = pane.querySelector<SVGElement>('svg[data-export-overlay]');
  if (overlay) await drawSvgOverlay(ctx, overlay, w, h);

  if (caption) drawCaption(ctx, caption, w, h);
  return out;
}

/**
 * Export the active viewport pane to a downloaded PNG. Returns false if the pane
 * or its canvas can't be found.
 */
export async function exportViewportPng(info: {
  orientation: ViewportOrientation;
  windowLevel?: number;
  windowWidth?: number;
}): Promise<boolean> {
  const pane = document.querySelector<HTMLElement>(`[data-viewport="${info.orientation}"]`);
  if (!pane) return false;

  const caption = buildCaption({ ...info, slice: parseSlice(pane.dataset.slice) });
  const canvas = await renderPaneToCanvas(pane, caption);
  if (!canvas) return false;

  triggerDownload(canvas.toDataURL('image/png'), exportFilename(info.orientation));
  return true;
}

/**
 * Export all currently-mounted viewport panes as a tiled collage with a clinical
 * info band. Each cell carries its own measurement overlay + caption. Returns
 * false if no drawable pane is found.
 */
export async function exportCollagePng(info: {
  study: StudyInfo;
  anonymize: boolean;
}): Promise<boolean> {
  const panes = [...document.querySelectorAll<HTMLElement>('[data-viewport]')].sort(
    (a, b) =>
      ORIENTATION_ORDER.indexOf(a.dataset.viewport as ViewportOrientation) -
      ORIENTATION_ORDER.indexOf(b.dataset.viewport as ViewportOrientation)
  );
  if (panes.length === 0) return false;

  const tiles: HTMLCanvasElement[] = [];
  for (const pane of panes) {
    const orientation = pane.dataset.viewport as ViewportOrientation;
    const caption = buildCaption({ orientation, slice: parseSlice(pane.dataset.slice) });
    const tile = await renderPaneToCanvas(pane, caption);
    if (tile) tiles.push(tile);
  }
  if (tiles.length === 0) return false;

  const cellW = Math.max(...tiles.map((t) => t.width));
  const cellH = Math.max(...tiles.map((t) => t.height));
  const cols = Math.ceil(Math.sqrt(tiles.length));
  const rows = Math.ceil(tiles.length / cols);

  const lines = buildStudyInfo(info.study, { anonymize: info.anonymize });
  const collageW = cols * cellW;
  const bandFont = Math.max(13, Math.round(collageW * 0.013));
  const lineH = Math.round(bandFont * 1.6);
  const bandH = lineH * (lines.length + 1);
  const collageH = bandH + rows * cellH;

  const out = document.createElement('canvas');
  out.width = collageW;
  out.height = collageH;
  const ctx = out.getContext('2d');
  if (!ctx) return false;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, collageW, collageH);

  // Clinical info band.
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, collageW, bandH);
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    ctx.font = `${i === 0 ? '600 ' : ''}${bandFont}px sans-serif`;
    ctx.fillStyle = i === 0 ? '#f5f5f5' : '#a3a3a3';
    ctx.fillText(line, bandFont, lineH * (i + 1));
  });

  // Tiles, each scaled to fit its cell (letterboxed on black), preserving aspect.
  tiles.forEach((tile, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const originX = col * cellW;
    const originY = bandH + row * cellH;
    const scale = Math.min(cellW / tile.width, cellH / tile.height);
    const dw = tile.width * scale;
    const dh = tile.height * scale;
    ctx.drawImage(tile, originX + (cellW - dw) / 2, originY + (cellH - dh) / 2, dw, dh);
  });

  triggerDownload(out.toDataURL('image/png'), exportFilename('collage'));
  return true;
}
