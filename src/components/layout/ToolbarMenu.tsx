/**
 * Toolbar dropdown primitive: a labeled trigger (styled like the Layout button)
 * plus a panel that opens below it and closes on outside-click or Escape.
 *
 * Shared by the Presets and Help menus so the trigger styling and dismiss
 * behavior stay identical. Children is a render-prop receiving `close` so menu
 * items can dismiss the panel after acting.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface ToolbarMenuProps {
  label: string;
  title?: string;
  disabled?: boolean;
  /** Tailwind width class for the dropdown panel. */
  width?: string;
  children: (close: () => void) => ReactNode;
}

export function ToolbarMenu({ label, title, disabled, width = 'w-56', children }: ToolbarMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute left-0 top-full z-50 mt-1 ${width} rounded-lg border border-neutral-800 bg-neutral-900 p-1 shadow-xl`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
