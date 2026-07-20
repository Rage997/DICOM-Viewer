/**
 * Export dropdown: choose "Active view" or "All views (collage)", plus an
 * anonymize toggle that de-identifies the collage's clinical info band.
 * Mirrors the Layout/Settings dropdowns via the shared ToolbarMenu primitive.
 */

import { useState } from 'react';
import { Image, LayoutGrid, Check } from 'lucide-react';
import { ToolbarMenu } from './ToolbarMenu';

interface ExportMenuProps {
  disabled?: boolean;
  onExportActive?: () => void;
  onExportCollage?: (anonymize: boolean) => void;
}

export function ExportMenu({ disabled, onExportActive, onExportCollage }: ExportMenuProps) {
  // Remembered across opens while the toolbar is mounted. Only affects the collage.
  const [anonymize, setAnonymize] = useState(false);

  return (
    <ToolbarMenu label="Export" title="Export view as PNG" disabled={disabled} width="w-60">
      {(close) => (
        <>
          <button
            role="menuitemcheckbox"
            aria-checked={anonymize}
            onClick={() => setAnonymize((a) => !a)}
            className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-[3px] border ${
                anonymize ? 'border-blue-400 bg-blue-500/20' : 'border-neutral-600'
              }`}
            >
              {anonymize && <Check className="h-3 w-3 text-blue-400" />}
            </span>
            <span className="flex-1">Anonymize patient info</span>
          </button>

          <div className="my-1 border-t border-neutral-800" />

          <button
            role="menuitem"
            onClick={() => {
              onExportActive?.();
              close();
            }}
            className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
          >
            <Image className="h-4 w-4 text-neutral-400" />
            <span className="flex-1 font-medium">Active view</span>
          </button>

          <button
            role="menuitem"
            onClick={() => {
              onExportCollage?.(anonymize);
              close();
            }}
            className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
          >
            <LayoutGrid className="h-4 w-4 text-neutral-400" />
            <span className="flex-1 font-medium">All views (collage)</span>
          </button>
        </>
      )}
    </ToolbarMenu>
  );
}
