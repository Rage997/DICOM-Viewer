/**
 * Series dropdown: lists loaded studies → series and switches the active series.
 * Until now the active series was fixed to the first one loaded; this is the
 * first UI to change it. Derives its list from the reconstructed volumes (only
 * viewable series appear), grouped by study, via the shared series catalog.
 */

import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { useStore } from '@/state/store';
import { ToolbarMenu } from './ToolbarMenu';
import { buildSeriesCatalog, seriesLabel } from '@/features/dicom/study';

// "YYYYMMDD" -> "YYYY-MM-DD"; anything else passes through.
function formatDate(value?: string): string | undefined {
  if (value && /^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return value || undefined;
}

export function SeriesMenu() {
  const files = useStore((s) => s.files);
  const volumes = useStore((s) => s.volumes);
  const activeSeriesUID = useStore((s) => s.activeSeriesUID);
  const setActiveSeriesUID = useStore((s) => s.setActiveSeriesUID);

  const catalog = useMemo(() => buildSeriesCatalog(files, volumes), [files, volumes]);
  const totalSeries = catalog.reduce((n, g) => n + g.series.length, 0);
  return (
    <ToolbarMenu label="Series" title="Switch active series" disabled={totalSeries === 0} width="w-80">
      {(close) => (
        <>
          {catalog.map((group) => {
            const heading = [formatDate(group.studyDate), group.studyDescription]
              .filter(Boolean)
              .join('  ·  ');
            return (
              <div key={group.studyInstanceUID} className="mb-1 last:mb-0">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  {heading || 'Study'}
                </div>
                {group.series.map((entry) => {
                  const active = entry.seriesInstanceUID === activeSeriesUID;
                  return (
                    <button
                      key={entry.seriesInstanceUID}
                      role="menuitem"
                      onClick={() => {
                        setActiveSeriesUID(entry.seriesInstanceUID);
                        close();
                      }}
                      className={`flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-neutral-800 ${
                        active ? 'text-white' : 'text-neutral-300'
                      }`}
                    >
                      <span className="flex-1 truncate">{seriesLabel(entry)}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-blue-400" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </>
      )}
    </ToolbarMenu>
  );
}
