/**
 * Renders the shared control reference (ALL_CONTROL_GROUPS) as grouped rows:
 * section title, then icon + input badge + effect per entry.
 *
 * Shared presentational component so the first-run "How to Navigate" modal and
 * the Help → Controls dialog show identical, single-sourced content.
 */

import { ALL_CONTROL_GROUPS } from '@/features/viewer/controlsReference';

export function ControlsReference() {
  return (
    <div className="space-y-5">
      {ALL_CONTROL_GROUPS.map((group) => (
        <div key={group.id}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {group.title}
          </div>
          <div className="space-y-1.5">
            {group.entries.map((entry) => (
              <div key={entry.input + entry.effect} className="flex items-center gap-3 text-sm">
                <span className="w-6 text-center">{entry.icon}</span>
                <span className="min-w-[84px] shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-center font-mono text-xs text-neutral-200">
                  {entry.input}
                </span>
                <span className="text-neutral-400">{entry.effect}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
