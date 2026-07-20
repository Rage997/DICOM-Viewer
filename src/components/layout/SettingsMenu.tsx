/**
 * Settings dropdown launched from the toolbar gear. The home for all application
 * settings, grouped into sections. Currently: 3D rendering.
 */

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useStore } from '@/state/store';
import { Dialog } from '@/components/common/Dialog';
import { VolumeRenderingSettings } from '@/components/viewer/VolumeRenderingSettings';

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const volumeSettings = useStore((s) => s.volumeSettings);
  const setVolumeSettings = useStore((s) => s.setVolumeSettings);
  const activeSeriesUID = useStore((s) => s.activeSeriesUID);
  const volumes = useStore((s) => s.volumes);
  const activeVolume = activeSeriesUID ? volumes.get(activeSeriesUID) ?? null : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
        title="Settings"
        aria-haspopup="dialog"
      >
        <Settings className="h-4 w-4" />
      </button>

      {open && (
        <Dialog title="Settings" onClose={() => setOpen(false)}>
          <div className="space-y-5">
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                3D Rendering
              </h3>
              {activeVolume ? (
                <VolumeRenderingSettings
                  settings={volumeSettings}
                  volume={activeVolume}
                  onChange={setVolumeSettings}
                />
              ) : (
                <p className="text-sm text-neutral-500">Load a study to adjust 3D rendering.</p>
              )}
            </section>
          </div>
        </Dialog>
      )}
    </>
  );
}
