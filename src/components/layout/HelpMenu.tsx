/**
 * Help dropdown: documentation and app info for clinicians.
 *
 * Items open modal dialogs — Getting Started (load & read a study), Studies &
 * Series (the DICOM hierarchy and how the viewer maps to it), Controls
 * (mouse/keyboard), Privacy & Data, and Technical Information.
 */

import { useState } from 'react';
import { ToolbarMenu } from './ToolbarMenu';
import { Dialog } from '@/components/common/Dialog';
import { ControlsReference } from '@/components/common/ControlsReference';

type HelpDialogId = 'getting-started' | 'studies-series' | 'controls' | 'privacy' | 'tech';

interface HelpMenuProps {
  backend?: string;
}

const MENU_ITEMS: { id: HelpDialogId; label: string; description: string }[] = [
  { id: 'getting-started', label: 'Getting Started', description: 'Load and read a study' },
  { id: 'studies-series', label: 'Studies & Series', description: 'How images are organized' },
  { id: 'controls', label: 'Controls', description: 'Mouse & keyboard reference' },
  { id: 'privacy', label: 'Privacy & Data', description: 'How your images are handled' },
  { id: 'tech', label: 'Technical Information', description: 'Version, renderer, browser' },
];

export function HelpMenu({ backend = 'WebGL2' }: HelpMenuProps) {
  const [dialog, setDialog] = useState<HelpDialogId | null>(null);

  return (
    <>
      <ToolbarMenu label="Help" title="Help & documentation" width="w-64">
        {(close) =>
          MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              onClick={() => {
                setDialog(item.id);
                close();
              }}
              className="flex w-full flex-col rounded px-2 py-1.5 text-left hover:bg-neutral-800 transition-colors"
            >
              <span className="text-sm font-medium text-neutral-200">{item.label}</span>
              <span className="text-xs text-neutral-500">{item.description}</span>
            </button>
          ))
        }
      </ToolbarMenu>

      {dialog === 'controls' && (
        <Dialog title="Controls" onClose={() => setDialog(null)}>
          <ControlsReference />
        </Dialog>
      )}

      {dialog === 'getting-started' && (
        <Dialog title="Getting Started" onClose={() => setDialog(null)}>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-neutral-300">
            <li>
              <span className="font-medium text-neutral-100">Load a study.</span> Click{' '}
              <span className="font-medium">Open Folder</span> to select a folder of DICOM files, or{' '}
              <span className="font-medium">Open Files</span> for individual files. You can also drag a
              folder straight onto the viewport. Loading is additive — open more folders to bring extra
              series in for comparison.
            </li>
            <li>
              <span className="font-medium text-neutral-100">Choose a series.</span> The viewer shows one
              series at a time. Use the <span className="font-medium">Series</span> menu to switch between
              the series in your loaded studies (see <span className="italic">Studies &amp; Series</span>).
            </li>
            <li>
              <span className="font-medium text-neutral-100">Review the planes.</span> The three 2D views
              (axial, sagittal, coronal) reconstruct automatically; the 3D view renders the volume. The{' '}
              <span className="font-medium">Layout</span> menu switches between single, quad, and 1+3
              arrangements.
            </li>
            <li>
              <span className="font-medium text-neutral-100">Navigate slices.</span> Scroll or drag the
              slider over any 2D view. Hover a view and use{' '}
              <span className="font-mono text-xs">←/→</span> to step through slices.
            </li>
            <li>
              <span className="font-medium text-neutral-100">Adjust the window.</span> Left-drag a 2D view
              to change brightness/contrast, or apply a preset from the{' '}
              <span className="font-medium">Presets</span> menu (keys{' '}
              <span className="font-mono text-xs">1–6</span>).
            </li>
            <li>
              <span className="font-medium text-neutral-100">Explore in 3D.</span> Left-drag to rotate,
              right-drag to pan, scroll to zoom, and use the anatomical view buttons for standard
              orientations. In <span className="font-medium">Settings</span> you can switch render modes
              (MIP / MinIP), apply a color map, and enable clipping planes to cut into the volume.
            </li>
            <li>
              <span className="font-medium text-neutral-100">Measure.</span> The{' '}
              <span className="font-medium">Measurements</span> menu adds distance, angle, and ROI tools on
              the 2D views. Measurements stay with the series they were drawn on.
            </li>
            <li>
              <span className="font-medium text-neutral-100">Compare two series.</span>{' '}
              <span className="font-medium">Layout → Compare</span> (once two or more series are loaded)
              shows two series side by side with optional linked scrolling and window/level.
            </li>
            <li>
              <span className="font-medium text-neutral-100">Export.</span> The{' '}
              <span className="font-medium">Export</span> menu saves the active view or a collage of all
              views as a PNG, with an option to anonymize patient details.
            </li>
          </ol>
        </Dialog>
      )}

      {dialog === 'studies-series' && (
        <Dialog title="Studies & Series" onClose={() => setDialog(null)}>
          <div className="space-y-4 text-sm text-neutral-300">
            <p>
              DICOM organizes images in a fixed hierarchy. Understanding it explains what the{' '}
              <span className="font-medium">Series</span> menu does and why the viewer shows one thing at a
              time.
            </p>

            <ul className="space-y-2">
              <li>
                <span className="font-medium text-neutral-100">Patient</span> — the person scanned.
              </li>
              <li className="pl-4">
                <span className="font-medium text-neutral-100">Study</span> — one exam or visit (e.g.{' '}
                <span className="italic">“Brain MRI, 2013-07-17”</span>). A study contains one or more
                series.
              </li>
              <li className="pl-8">
                <span className="font-medium text-neutral-100">Series</span> — one acquisition sequence
                (e.g. <span className="italic">T1 axial</span>, <span className="italic">T2 FLAIR</span>,
                post-contrast). <span className="font-medium text-neutral-100">A series is what becomes a
                single 3D volume</span> — the thing you view and reconstruct into axial/sagittal/coronal
                planes.
              </li>
              <li className="pl-12">
                <span className="font-medium text-neutral-100">Slices</span> — the individual images that
                stack together to form one series.
              </li>
            </ul>

            <p>
              When you load files, they’re grouped by series automatically, and each series is rebuilt into
              its own 3D volume. The <span className="font-medium">Series</span> menu lists every loaded
              series, grouped under its study. Each entry reads{' '}
              <span className="font-mono text-xs text-neutral-400">
                #number · description · modality · slice count
              </span>{' '}
              — for example{' '}
              <span className="font-mono text-xs text-neutral-400">#401 · anat-T1w · MR · 384 sl</span>.
            </p>

            <p>
              <span className="font-medium text-neutral-100">Example:</span> a simple brain-MRI folder may
              hold a single series of 384 slices, so it loads as one volume. A full clinical study usually
              has several series (T1, T2, FLAIR, …) — switch between them with the{' '}
              <span className="font-medium">Series</span> menu, or view two at once with{' '}
              <span className="font-medium">Compare</span>.
            </p>
          </div>
        </Dialog>
      )}

      {dialog === 'privacy' && (
        <Dialog title="Privacy & Data" onClose={() => setDialog(null)}>
          <div className="space-y-3 text-sm text-neutral-300">
            <p>
              <span className="font-medium text-neutral-100">Your images never leave this device.</span>{' '}
              All DICOM parsing, reconstruction, and rendering happen locally in your browser.
            </p>
            <p>
              There are no uploads, no servers, and no analytics or telemetry. The application works fully
              offline once loaded.
            </p>
            <p>
              Loaded studies live only in memory and are discarded when you close the study or the tab. No
              patient data is written to disk or shared with third parties.
            </p>
          </div>
        </Dialog>
      )}

      {dialog === 'tech' && (
        <Dialog title="Technical Information" onClose={() => setDialog(null)}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-neutral-800 pb-2">
              <span className="text-neutral-400">Version</span>
              <span className="font-mono text-neutral-200">{__APP_VERSION__}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-800 pb-2">
              <span className="text-neutral-400">Rendering Backend</span>
              <span className="font-mono text-emerald-500">{backend.toUpperCase()}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-800 pb-2">
              <span className="text-neutral-400">Browser</span>
              <span className="font-mono text-neutral-200 text-xs">
                {navigator.userAgent.split(/[()]/)[1]?.split(';')[0] || 'Unknown'}
              </span>
            </div>
            <div className="mt-4 rounded bg-neutral-800/50 p-3 text-xs text-neutral-400">
              <p>
                This information is for technical support and debugging purposes only. Medical
                professionals typically do not need these details.
              </p>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
