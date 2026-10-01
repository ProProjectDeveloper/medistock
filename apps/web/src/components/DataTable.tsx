import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { cx } from './ui';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right';
  mono?: boolean;
  className?: string;
  hideBelow?: 'md' | 'lg';
}

export function DataTable<T>({
  rows, columns, rowKey, rowHref, empty, pageSize = 25, initialSort, caption, selectable, selected, onSelect,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  rowHref?: (r: T) => string;
  empty?: ReactNode;
  pageSize?: number;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  caption: string;
  selectable?: boolean;
  selected?: Set<string>;
  onSelect?: (next: Set<string>) => void;
}) {
  const navigate = useNavigate();
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a), vb = col.sortValue!(b);
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * dir;
    });
  }, [rows, columns, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const p = Math.min(page, pages - 1);
  const view = sorted.slice(p * pageSize, (p + 1) * pageSize);
  const hide = { md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };
  const allOnPage = view.length > 0 && view.every((r) => selected?.has(rowKey(r)));

  const toggle = (k: string) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k); else next.add(k);
    onSelect?.(next);
  };

  if (!rows.length) return <>{empty}</>;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-[1] bg-surface">
            <tr className="border-b border-line">
              {selectable && (
                <th className="w-10 px-3 py-2.5">
                  <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} className="h-4 w-4 accent-[var(--brand)]"
                    onChange={() => {
                      const next = new Set(selected);
                      view.forEach((r) => (allOnPage ? next.delete(rowKey(r)) : next.add(rowKey(r))));
                      onSelect?.(next);
                    }} />
                </th>
              )}
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cx('label whitespace-nowrap px-4 py-2.5 font-semibold', c.align === 'right' && 'text-right', c.hideBelow && hide[c.hideBelow])}>
                    {c.sortValue ? (
                      <button className={cx('inline-flex items-center gap-1 uppercase hover:text-ink', active && 'text-ink', c.align === 'right' && 'flex-row-reverse')}
                        onClick={() => setSort(active ? { key: c.key, dir: sort!.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' })}>
                        {c.header}
                        {active ? (sort!.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : <ChevronsUpDown size={13} className="opacity-50" />}
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => {
              const k = rowKey(r);
              const href = rowHref?.(r);
              return (
                <tr key={k}
                  className={cx('border-b border-line last:border-0 transition-colors', href && 'cursor-pointer hover:bg-surface-2', selected?.has(k) && 'bg-brand-tint')}
                  onClick={(e) => {
                    if (!href || (e.target as HTMLElement).closest('a,button,input,label')) return;
                    navigate(href);
                  }}>
                  {selectable && (
                    <td className="px-3 py-2.5">
                      <input type="checkbox" aria-label="Select row" checked={!!selected?.has(k)} onChange={() => toggle(k)} className="h-4 w-4 accent-[var(--brand)]" />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cx('h-12 px-4 py-2 align-middle', c.align === 'right' && 'text-right', c.mono && 'num text-sm', c.hideBelow && hide[c.hideBelow], c.className)}>
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-sm text-ink-2">
          <span className="num">{p * pageSize + 1}–{Math.min(sorted.length, (p + 1) * pageSize)} of {sorted.length}</span>
          <div className="flex gap-1">
            <button className="rounded-sm p-1.5 hover:bg-surface-2 disabled:opacity-40" disabled={p === 0} onClick={() => setPage(p - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
            <button className="rounded-sm p-1.5 hover:bg-surface-2 disabled:opacity-40" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
