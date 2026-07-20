/**
 * Main application toolbar
 * Clean, minimal, action-focused
 */

import { Upload, FolderOpen, X } from 'lucide-react';
import { PresetMenu } from './PresetMenu';
import { HelpMenu } from './HelpMenu';
import { LayoutMenu } from './LayoutMenu';
import { SettingsMenu } from './SettingsMenu';
import { MeasurementsMenu } from './MeasurementsMenu';
import { ExportMenu } from './ExportMenu';
import { SeriesMenu } from './SeriesMenu';
import type { LayoutMode } from '@/types';

interface ToolbarProps {
  onOpenFiles?: () => void;
  onOpenFolder?: () => void;
  onCloseStudy?: () => void;
  onApplyPreset?: (windowLevel: number, windowWidth: number) => void;
  windowLevel?: number;
  windowWidth?: number;
  disabled?: boolean;
  hasStudy?: boolean;
  backend?: string;
  layout?: LayoutMode;
  onLayoutChange?: (layout: LayoutMode) => void;
  layoutDisabled?: boolean;
  compareDisabled?: boolean;
  onExportActive?: () => void;
  onExportCollage?: (anonymize: boolean) => void;
  measurementsListOpen?: boolean;
  onToggleMeasurementsList?: () => void;
}

export function Toolbar({
  onOpenFiles,
  onOpenFolder,
  onCloseStudy,
  onApplyPreset,
  windowLevel,
  windowWidth,
  disabled,
  hasStudy,
  backend = 'WebGL2',
  layout = 'quad',
  onLayoutChange,
  layoutDisabled,
  compareDisabled,
  onExportActive,
  onExportCollage,
  measurementsListOpen,
  onToggleMeasurementsList,
}: ToolbarProps) {
  return (
    <div className="flex h-11 items-center gap-1 border-b border-neutral-800 bg-neutral-900 px-3">
      {/* Primary Actions */}
      <button
        onClick={onOpenFiles}
        disabled={disabled}
        className="flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Import DICOM files (Ctrl+O)"
      >
        <Upload className="h-4 w-4" />
        Open Files
      </button>

      <button
        onClick={onOpenFolder}
        disabled={disabled}
        className="flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Import DICOM folder"
      >
        <FolderOpen className="h-4 w-4" />
        Open Folder
      </button>

      {hasStudy && (
        <button
          onClick={onCloseStudy}
          disabled={disabled}
          className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Close current study"
        >
          <X className="h-4 w-4" />
          Close Study
        </button>
      )}

      {/* Window/Level presets (CT) — grouped dropdown; keys 1..6 */}
      {hasStudy && (
        <>
          <div className="mx-2 h-6 w-px bg-neutral-800" />
          <PresetMenu
            onApplyPreset={onApplyPreset}
            windowLevel={windowLevel}
            windowWidth={windowWidth}
            disabled={disabled}
          />
        </>
      )}

      {/* Series switcher (appears once a study is loaded) */}
      {hasStudy && <SeriesMenu />}

      {/* Layout */}
      <LayoutMenu
        layout={layout}
        onChange={onLayoutChange}
        disabled={layoutDisabled}
        compareDisabled={compareDisabled}
      />

      {/* Help & documentation */}
      <HelpMenu backend={backend} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Secondary Actions */}
      <ExportMenu
        disabled={!hasStudy}
        onExportActive={onExportActive}
        onExportCollage={onExportCollage}
      />

      <MeasurementsMenu
        disabled={!hasStudy}
        listOpen={measurementsListOpen}
        onToggleList={onToggleMeasurementsList}
      />

      <SettingsMenu />
    </div>
  );
}
