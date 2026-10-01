import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { addMonths, bandFor, daysBetween, formatExpiryShort, relativeDays, type Band, type Settings, type StockStatus } from '@medistock/core';

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

// ---------- Button ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong border border-transparent',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2 hover:border-ink-3',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-surface-2 hover:text-ink',
  danger: 'bg-expired text-white border border-transparent hover:opacity-90 dark:text-paper',
};
const sizes: Record<Size, string> = { sm: 'h-8 px-3 text-sm gap-1.5', md: 'h-10 px-4 text-[15px] gap-2', lg: 'h-12 px-5 text-md gap-2' };

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: ReactNode }>(
  function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cx(
          'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-150 ease-brand disabled:pointer-events-none disabled:opacity-50',
          variants[variant], sizes[size], className,
        )}
        {...rest}
      >
        {icon}
        {children}
      </button>
    );
  },
);

export function ButtonLink({ to, variant = 'secondary', size = 'md', icon, children, className }: { to: string; variant?: Variant; size?: Size; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cx('inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-150', variants[variant], sizes[size], className)}>
      {icon}
      {children}
    </Link>
  );
}

// ---------- Form fields ----------

export function Field({ label, help, error, children, className, htmlFor }: { label: string; help?: ReactNode; error?: string | null; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{label}</label>
      {children}
      {error ? <p className="text-sm text-expired">{error}</p> : help ? <p className="text-sm text-ink-3">{help}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; help?: ReactNode; error?: string | null; mono?: boolean }>(
  function Input({ label, help, error, mono, className, id, ...rest }, ref) {
    const auto = useId();
    const iid = id ?? auto;
    const input = <input ref={ref} id={iid} aria-invalid={!!error || undefined} className={cx('input', mono && 'num', !label && className)} {...rest} />;
    if (!label) return input;
    return <Field label={label} help={help} error={error} htmlFor={iid} className={className}>{input}</Field>;
  },
);

export function Select({ label, help, error, className, id, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; help?: ReactNode; error?: string | null }) {
  const auto = useId();
  const iid = id ?? auto;
  const sel = (
    <select id={iid} className={cx('input appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9', !label && className)}
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237C9095' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
      {...rest}>
      {children}
    </select>
  );
  if (!label) return sel;
  return <Field label={label} help={help} error={error} htmlFor={iid} className={className}>{sel}</Field>;
}

// ---------- Status ----------

const bandText: Record<Band, string> = { expired: 'text-expired', critical: 'text-critical', soon: 'text-soon', ok: 'text-ok' };
const bandBg: Record<Band, string> = { expired: 'bg-expired-tint', critical: 'bg-critical-tint', soon: 'bg-soon-tint', ok: 'bg-ok-tint' };
const bandDot: Record<Band, string> = { expired: 'bg-expired', critical: 'bg-critical', soon: 'bg-soon', ok: 'bg-ok' };
export const bandClasses = { text: bandText, bg: bandBg, dot: bandDot };

export function BandPill({ band, days, label, className }: { band: Band; days?: number | null; label?: string; className?: string }) {
  const text = label ?? (days == null ? '' : relativeDays(days));
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-0.5 text-sm font-medium', bandText[band], bandBg[band], className)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', bandDot[band])} aria-hidden />
      {text}
    </span>
  );
}

export function StockBadge({ status }: { status: StockStatus }) {
  const map = {
    out: ['Out of stock', 'text-expired bg-expired-tint', 'bg-expired'],
    low: ['Low stock', 'text-info bg-info-tint', 'bg-info'],
    in: ['In stock', 'text-ink-2 bg-surface-2', 'bg-ink-3'],
  } as const;
  const [label, cls, dot] = map[status];
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-0.5 text-sm font-medium', cls)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />
      {label}
    </span>
  );
}

export function LotLabel({ lot, expiry, className }: { lot: string; expiry?: string; className?: string }) {
  return (
    <span className={cx('num inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border border-line bg-surface px-1.5 py-px text-xs text-ink-2', className)}>
      <span className="text-ink-3">LOT</span> <span className="text-ink">{lot}</span>
      {expiry && <><span className="text-ink-3">· EXP</span> <span className="text-ink">{formatExpiryShort(expiry)}</span></>}
    </span>
  );
}

/** Today → +12 months; the batch's expiry is a dot in its band colour and the time left until it is shaded. */
export function ExpiryRibbon({ expiry, today, settings, size = 'row', className }: { expiry: string; today: string; settings: Settings; size?: 'row' | 'card'; className?: string }) {
  const horizon = daysBetween(today, addMonths(today, 12));
  const d = daysBetween(today, expiry);
  const band = bandFor(d, settings);
  const pos = Math.max(0, Math.min(1, d / horizon));
  const h = size === 'row' ? 'h-1' : 'h-1.5';
  return (
    <div className={cx('relative', size === 'row' ? 'w-24' : 'w-full', className)} role="img" aria-label={`Expiry ${relativeDays(d).toLowerCase()} on a 12-month scale`}>
      <div className={cx('relative w-full overflow-hidden rounded-pill bg-surface-2', h)}>
        <div className={cx('absolute inset-y-0 left-0 opacity-40', bandDot[band])} style={{ width: `${pos * 100}%` }} />
        {size === 'card' && [3, 6, 9].map((m) => (
          <div key={m} className="absolute inset-y-0 w-px bg-line" style={{ left: `${(m / 12) * 100}%` }} />
        ))}
      </div>
      <span
        className={cx('absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface', bandDot[band], size === 'row' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5')}
        style={{ left: `${pos * 100}%` }}
      />
      {size === 'card' && (
        <div className="mt-2.5 flex justify-between text-[11px] text-ink-3">
          <span className="pl-2.5">Today</span><span>3 mo</span><span>6 mo</span><span>9 mo</span><span>12 mo</span>
        </div>
      )}
    </div>
  );
}

// ---------- Layout bits ----------

export function Card({ children, className, title, action, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; padded?: boolean }) {
  return (
    <section className={cx('card', className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-md font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && <div className="mb-2 text-sm">{back}</div>}
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function KpiTile({ label, value, sub, tone, icon, to }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Band | 'info'; icon?: ReactNode; to?: string }) {
  const toneCls = tone === 'info' ? 'bg-info-tint border-transparent' : tone ? cx(bandBg[tone], 'border-transparent') : 'bg-surface';
  const toneText = tone === 'info' ? 'text-info' : tone ? bandText[tone] : 'text-ink-2';
  const body = (
    <div className={cx('h-full rounded-md border border-line p-5 transition-shadow', toneCls, to && 'hover:shadow-raised')}>
      <div className="flex items-center justify-between">
        <span className={cx('label', tone && toneText)}>{label}</span>
        {icon && <span className={toneText}>{icon}</span>}
      </div>
      <div className={cx('mt-3 font-display text-2xl font-semibold leading-none', tone && tone !== 'ok' ? toneText : 'text-ink')}>{value}</div>
      {sub && <div className="mt-2 text-sm text-ink-2">{sub}</div>}
    </div>
  );
  return to ? <Link to={to} className="block rounded-md">{body}</Link> : body;
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode; count?: number; tone?: Band }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button key={it.value} role="tab" aria-selected={active} onClick={() => onChange(it.value)}
            className={cx('-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'border-brand text-ink' : 'border-transparent text-ink-2 hover:text-ink')}>
            {it.tone && <span className={cx('h-2 w-2 rounded-full', bandDot[it.tone])} aria-hidden />}
            {it.label}
            {it.count != null && <span className={cx('num rounded-pill px-1.5 text-xs', active ? 'bg-brand-tint text-brand' : 'bg-surface-2 text-ink-2')}>{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-3">{icon}</div>
      <p className="font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-2">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not([aria-label="Close"])');
    first?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(8,20,22,.45)] p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        className={cx('animate-rise flex max-h-[90vh] w-full flex-col rounded-t-lg border border-line bg-surface shadow-overlay sm:rounded-lg', size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-sm p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"><X size={18} /></button>
        </header>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</footer>}
      </div>
    </div>
  );
}

export function Stat({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className={cx('mt-1 text-ink', mono && 'num')}>{value}</dd>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-surface-2 p-0.5">
      {items.map((it) => (
        <button key={it.value} role="radio" aria-checked={it.value === value} onClick={() => onChange(it.value)}
          className={cx('rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors', it.value === value ? 'bg-surface text-ink shadow-raised' : 'text-ink-2 hover:text-ink')}>
          {it.label}
        </button>
      ))}
    </div>
  );
}
