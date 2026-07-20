/**
 * Measurement overlay — an SVG layer over a 2D slice canvas that draws and edits
 * distance / angle / ROI measurements for the current slice.
 *
 * Pointer model (avoids colliding with window/level drag on the canvas below):
 *  - the SVG root is pointer-events:none, so empty space falls through to the canvas;
 *  - when a tool is active a full-area capture rect (pointer-events:auto) takes
 *    placement clicks and forwards wheel → slice change;
 *  - handles are always interactive, so measurements can be edited with no active tool.
 *
 * Points are stored in slice voxel coordinates; the transform re-derives from the
 * live container size so measurements track letterboxing, resize, and layout changes.
 */

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/state/store';
import { sliceDimensions, measurementsForSlice, measurementResult, screenToVoxel, voxelToScreen, IDENTITY_VIEW, type ViewTransform } from '@/features/viewer/measurements';
import type { Volume, SliceOrientation, MeasurementPoint, Measurement } from '@/types';

interface MeasurementOverlayProps {
  volume: Volume;
  orientation: SliceOrientation;
  sliceIndex: number;
  onSliceChange?: (index: number) => void;
  view?: ViewTransform;
}

const POINTS_REQUIRED: Record<Measurement['tool'], number> = { distance: 2, angle: 3, roi: 2 };

export function MeasurementOverlay({ volume, orientation, sliceIndex, onSliceChange, view = IDENTITY_VIEW }: MeasurementOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [draft, setDraft] = useState<MeasurementPoint[]>([]);
  const [hover, setHover] = useState<MeasurementPoint | null>(null);
  const [dragging, setDragging] = useState<{ id: string; index: number } | null>(null);

  const activeTool = useStore((s) => s.activeTool);
  const allMeasurements = useStore((s) => s.measurements);
  const selectedId = useStore((s) => s.selectedMeasurementId);
  const addMeasurement = useStore((s) => s.addMeasurement);
  const updateMeasurementPoints = useStore((s) => s.updateMeasurementPoints);
  const removeMeasurement = useStore((s) => s.removeMeasurement);
  const setSelectedMeasurement = useStore((s) => s.setSelectedMeasurement);
  const setActiveTool = useStore((s) => s.setActiveTool);

  const measurements = measurementsForSlice(allMeasurements, {
    seriesInstanceUID: volume.seriesInstanceUID,
    orientation,
    sliceIndex,
  });

  const { width: vw, height: vh } = sliceDimensions(volume, orientation);

  // Letterbox + pan/zoom transform (matches SliceRenderer); shared with the probe.
  const rect = { left: 0, top: 0, width: size.w, height: size.h };
  const toScreen = (p: MeasurementPoint) => voxelToScreen(p, rect, vw, vh, view);

  // Track container size.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const update = () => setSize({ w: svg.clientWidth, h: svg.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  // Reset in-progress draft when the tool or slice changes.
  useEffect(() => {
    setDraft([]);
    setHover(null);
  }, [activeTool, orientation, sliceIndex]);

  // Convert a pointer event to slice voxel coordinates from the live SVG rect.
  const toVoxel = (clientX: number, clientY: number): MeasurementPoint => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    return screenToVoxel(clientX, clientY, svg.getBoundingClientRect(), vw, vh, view);
  };

  // Handle drag: update the dragged point via window listeners until release.
  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (e: PointerEvent) => {
      const m = measurements.find((x) => x.id === dragging.id);
      if (!m) return;
      const points = m.points.map((p, i) => (i === dragging.index ? toVoxel(e.clientX, e.clientY) : p));
      updateMeasurementPoints(dragging.id, points);
    };
    const onUp = () => setDragging(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, measurements, updateMeasurementPoints]);

  // Escape cancels the draft or deactivates; Delete removes the selected measurement.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (draft.length > 0) setDraft([]);
        else if (activeTool) setActiveTool(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const target = allMeasurements.find((m) => m.id === selectedId);
        if (
          target &&
          target.seriesInstanceUID === volume.seriesInstanceUID &&
          target.orientation === orientation &&
          target.sliceIndex === sliceIndex
        ) {
          e.preventDefault();
          removeMeasurement(selectedId);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft, activeTool, selectedId, allMeasurements, orientation, sliceIndex, setActiveTool, removeMeasurement]);

  const placePoint = (clientX: number, clientY: number) => {
    if (!activeTool) return;
    const point = toVoxel(clientX, clientY);
    const next = [...draft, point];
    if (next.length >= POINTS_REQUIRED[activeTool]) {
      addMeasurement({
        id: crypto.randomUUID(),
        seriesInstanceUID: volume.seriesInstanceUID,
        tool: activeTool,
        orientation,
        sliceIndex,
        points: next,
      });
      setDraft([]);
      setHover(null);
    } else {
      setDraft(next);
    }
  };

  const labelFor = (m: Measurement): string => measurementResult(m, volume).label;

  const startDrag = (e: React.PointerEvent, id: string, index: number) => {
    e.stopPropagation();
    setSelectedMeasurement(id);
    setDragging({ id, index });
  };

  const toolActive = activeTool !== null;

  return (
    <svg
      ref={svgRef}
      data-export-overlay
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {/* Capture layer for placement + wheel forwarding (only while a tool is active) */}
      {toolActive && (
        <rect
          x={0}
          y={0}
          width="100%"
          height="100%"
          fill="transparent"
          className="pointer-events-auto cursor-crosshair"
          onClick={(e) => placePoint(e.clientX, e.clientY)}
          onPointerMove={(e) => setHover(toVoxel(e.clientX, e.clientY))}
          onWheel={(e) => {
            if (onSliceChange) onSliceChange(sliceIndex + (e.deltaY > 0 ? 1 : -1));
          }}
        />
      )}

      {measurements.map((m) => (
        <MeasurementShape
          key={m.id}
          measurement={m}
          toScreen={toScreen}
          label={labelFor(m)}
          selected={m.id === selectedId}
          onHandleDown={startDrag}
        />
      ))}

      {/* In-progress draft */}
      {draft.length > 0 && activeTool && (
        <DraftShape tool={activeTool} points={draft} hover={hover} toScreen={toScreen} />
      )}
    </svg>
  );
}

interface ShapeProps {
  measurement: Measurement;
  toScreen: (p: MeasurementPoint) => { x: number; y: number };
  label: string;
  selected: boolean;
  onHandleDown: (e: React.PointerEvent, id: string, index: number) => void;
}

function MeasurementShape({ measurement, toScreen, label, selected, onHandleDown }: ShapeProps) {
  const pts = measurement.points.map(toScreen);
  const stroke = selected ? '#60a5fa' : '#34d399';

  const polyline =
    measurement.tool === 'roi' && pts[0] && pts[1]
      ? null
      : pts.map((p) => `${p.x},${p.y}`).join(' ');

  const labelAnchor = pts[pts.length - 1] ?? { x: 0, y: 0 };

  return (
    <g>
      {measurement.tool === 'roi' && pts[0] && pts[1] ? (
        <rect
          x={Math.min(pts[0].x, pts[1].x)}
          y={Math.min(pts[0].y, pts[1].y)}
          width={Math.abs(pts[1].x - pts[0].x)}
          height={Math.abs(pts[1].y - pts[0].y)}
          fill="rgba(52, 211, 153, 0.08)"
          stroke={stroke}
          strokeWidth={1.5}
        />
      ) : (
        <polyline points={polyline ?? ''} fill="none" stroke={stroke} strokeWidth={1.5} />
      )}

      {label && (
        <text
          x={labelAnchor.x + 8}
          y={labelAnchor.y - 8}
          fill={stroke}
          fontSize={12}
          fontFamily="monospace"
          className="select-none"
          style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.7)', strokeWidth: 3 }}
        >
          {label}
        </text>
      )}

      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={5}
          fill={stroke}
          className="pointer-events-auto cursor-grab"
          onPointerDown={(e) => onHandleDown(e, measurement.id, i)}
        />
      ))}
    </g>
  );
}

interface DraftProps {
  tool: Measurement['tool'];
  points: MeasurementPoint[];
  hover: MeasurementPoint | null;
  toScreen: (p: MeasurementPoint) => { x: number; y: number };
}

function DraftShape({ tool, points, hover, toScreen }: DraftProps) {
  const pts = points.map(toScreen);
  const preview = hover ? toScreen(hover) : null;
  const chain = preview ? [...pts, preview] : pts;

  return (
    <g>
      {tool === 'roi' && pts[0] && preview ? (
        <rect
          x={Math.min(pts[0].x, preview.x)}
          y={Math.min(pts[0].y, preview.y)}
          width={Math.abs(preview.x - pts[0].x)}
          height={Math.abs(preview.y - pts[0].y)}
          fill="rgba(96, 165, 250, 0.08)"
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      ) : (
        <polyline
          points={chain.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="#60a5fa" />
      ))}
    </g>
  );
}
