import { useId, useMemo, useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import type { Medicine } from '@medistock/core';
import { useData } from '../lib/store';
import { cx } from './ui';

/** Type a name or scan a barcode (scanner sends Enter). Keyboard: arrows + Enter. */
export function MedicinePicker({ value, onChange, label = 'Medicine', autoFocus }: { value: string | null; onChange: (id: string) => void; label?: string; autoFocus?: boolean }) {
  const { ds } = useData();
  const id = useId();
  const selected = ds.medicines.find((m) => m.id === value) ?? null;
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = ds.medicines.filter((m) => m.isActive);
    if (!s) return list.slice(0, 8);
    return list.filter((m) => m.name.toLowerCase().includes(s) || m.genericName.toLowerCase().includes(s) || m.barcode.includes(s)).slice(0, 8);
  }, [q, ds]);
  const pick = (m: Medicine) => { onChange(m.id); setQ(''); setOpen(false); };
  const text = open ? q : selected ? `${selected.name} ${selected.strength}` : q;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <div className="relative">
        <input id={id} className="input pr-10" role="combobox" aria-expanded={open} aria-autocomplete="list" autoComplete="off" autoFocus={autoFocus}
          placeholder="Search or scan barcode" value={text}
          onFocus={() => setQ('')}
          onClick={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === 'Enter') {
              e.preventDefault();
              const exact = ds.medicines.find((m) => m.barcode === q.trim());
              if (exact) pick(exact); else if (results[active]) pick(results[active]);
            }
            if (e.key === 'Escape') setOpen(false);
          }} />
        <ScanBarcode size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" />
        {open && results.length > 0 && (
          <ul role="listbox" className="absolute left-0 right-0 top-11 z-30 max-h-72 overflow-auto rounded-md border border-line bg-surface py-1 shadow-overlay">
            {results.map((m, i) => (
              <li key={m.id} role="option" aria-selected={i === active}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(m)} onMouseEnter={() => setActive(i)}
                  className={cx('flex w-full items-center justify-between gap-3 px-3 py-2 text-left', i === active && 'bg-surface-2')}>
                  <span className="min-w-0"><span className="font-medium text-ink">{m.name}</span> <span className="text-ink-2">{m.strength}</span>
                    <span className="block truncate text-sm text-ink-3">{m.genericName}</span></span>
                  <span className="num shrink-0 text-xs text-ink-3">{m.barcode}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
