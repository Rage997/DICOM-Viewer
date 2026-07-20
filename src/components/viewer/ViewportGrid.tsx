import { Viewport } from './Viewport';
import { VIEWPORT_ORIENTATIONS } from '@/types';
import type { Volume, LayoutMode, ViewportOrientation } from '@/types';

interface ViewportGridProps {
  hasData?: boolean;
  onDrop?: (dataTransfer: DataTransfer) => void;
  onLoadDemo?: () => void;
  volume?: Volume | null;
  windowLevel?: number;
  windowWidth?: number;
  singleSlice?: boolean;
  layout?: LayoutMode;
  activeOrientation?: ViewportOrientation;
  onSelectOrientation?: (orientation: ViewportOrientation) => void;
  onWindowLevelChange?: (level: number, width: number) => void;
}

export function ViewportGrid({
  hasData = false,
  onDrop,
  onLoadDemo,
  volume,
  windowLevel,
  windowWidth,
  singleSlice = false,
  layout = 'quad',
  activeOrientation = 'axial',
  onSelectOrientation,
  onWindowLevelChange,
}: ViewportGridProps) {
  // Build a pane for one orientation. Slice planes get window/level wiring; the
  // 3D pane does not. `selectable` enables click-to-promote + the active ring.
  const renderPane = (orientation: ViewportOrientation, selectable: boolean) => {
    const isActive = selectable && hasData && orientation === activeOrientation;
    const onSelect =
      selectable && hasData ? () => onSelectOrientation?.(orientation) : undefined;

    if (orientation === '3d') {
      return (
        <Viewport
          orientation="3d"
          isEmpty={!hasData}
          onDrop={onDrop}
          volume={volume}
          isActive={isActive}
          onSelect={onSelect}
        />
      );
    }

    return (
      <Viewport
        orientation={orientation}
        isEmpty={!hasData}
        onDrop={onDrop}
        onLoadDemo={onLoadDemo}
        volume={volume}
        windowLevel={windowLevel}
        windowWidth={windowWidth}
        onWindowLevelChange={onWindowLevelChange}
        isActive={isActive}
        onSelect={onSelect}
      />
    );
  };

  // Single-slice studies have no orthogonal planes: always one axial pane.
  if (hasData && singleSlice) {
    return (
      <div className="h-full w-full bg-neutral-950">
        <Viewport
          orientation="axial"
          isEmpty={false}
          onDrop={onDrop}
          volume={volume}
          windowLevel={windowLevel}
          windowWidth={windowWidth}
          onWindowLevelChange={onWindowLevelChange}
        />
      </div>
    );
  }

  if (layout === 'single') {
    return (
      <div className="h-full w-full bg-neutral-950">{renderPane(activeOrientation, false)}</div>
    );
  }

  if (layout === 'one-plus-three') {
    const others = VIEWPORT_ORIENTATIONS.filter((o) => o !== activeOrientation);
    return (
      <div className="flex h-full w-full gap-[2px] bg-neutral-950">
        <div className="min-w-0 flex-[2]">{renderPane(activeOrientation, true)}</div>
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          {others.map((o) => (
            <div key={o} className="min-h-0 flex-1">
              {renderPane(o, true)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Quad (default): 2×2 axial / sagittal / coronal / 3D.
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-[2px] bg-neutral-950">
      {VIEWPORT_ORIENTATIONS.map((o) => (
        <div key={o} className="min-h-0 min-w-0">
          {renderPane(o, true)}
        </div>
      ))}
    </div>
  );
}
