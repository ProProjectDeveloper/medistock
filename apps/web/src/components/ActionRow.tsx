import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Band } from '@medistock/core';
import { bandClasses, cx } from './ui';

/** Alert row / action card: band stripe on the left edge, title, meta, primary action. */
export function ActionRow({ band, tone, title, meta, action, to }: { band?: Band | null; tone?: 'info'; title: ReactNode; meta?: ReactNode; action?: ReactNode; to?: string }) {
  const stripe = band ? bandClasses.dot[band] : tone === 'info' ? 'bg-info' : 'bg-line';
  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-md border border-line bg-surface py-3 pl-4 pr-3">
      <span className={cx('absolute inset-y-0 left-0 w-1', stripe)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-ink">{to ? <Link to={to} className="hover:underline">{title}</Link> : title}</div>
        {meta && <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">{meta}</div>}
      </div>
      {action}
    </div>
  );
}
