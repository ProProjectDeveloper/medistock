import { useState } from 'react';
import type { Band } from '@medistock/core';
import { cx } from './ui';

const BAND_VAR: Record<Band, string> = { expired: 'var(--expired)', critical: 'var(--critical)', soon: 'var(--soon)', ok: 'var(--ok)' };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Stacked vertical bars. Each bar holds values per band. */
export function StackedBars({ data, format, height = 220, bands = ['expired', 'critical', 'soon', 'ok'], label }: {
  data: { label: string; values: Partial<Record<Band, number>> }[];
  format: (n: number) => string;
  height?: number;
  bands?: Band[];
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => bands.reduce((s, b) => s + (d.values[b] ?? 0), 0));
  const max = niceMax(Math.max(...totals));
  const W = 640, H = height, padL = 66, padB = 28, padT = 8;
  const innerH = H - padB - padT;
  const bw = (W - padL) / data.length;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        {ticks.map((t) => {
          const y = padT + innerH * (1 - t);
          return (
            <g key={t}>
              <line x1={padL} x2={W} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)" className="num">{format(max * t)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          let y = padT + innerH;
          const x = padL + i * bw + bw * 0.22;
          const w = bw * 0.56;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * bw} y={padT} width={bw} height={innerH} fill={hover === i ? 'var(--surface-2)' : 'transparent'} />
              {bands.map((b) => {
                const v = d.values[b] ?? 0;
                if (!v) return null;
                const h = (v / max) * innerH;
                y -= h;
                return <rect key={b} x={x} y={y} width={w} height={Math.max(h - 1.5, 0.5)} rx={2} fill={BAND_VAR[b]} />;
              })}
              <text x={padL + i * bw + bw / 2} y={H - 9} textAnchor="middle" fontSize={11} fill="var(--ink-3)">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-2 rounded-sm border border-line bg-surface px-3 py-2 text-xs shadow-raised"
          style={{ left: `${((padL + hover * bw + bw / 2) / W) * 100}%`, transform: 'translateX(-50%)' }}>
          <div className="mb-1 font-semibold text-ink">{data[hover].label}</div>
          {bands.filter((b) => data[hover].values[b]).map((b) => (
            <div key={b} className="flex items-center gap-2 text-ink-2">
              <span className="h-2 w-2 rounded-full" style={{ background: BAND_VAR[b] }} />
              <span className="num">{format(data[hover].values[b]!)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LineChart({ points, height = 160, label, format }: { points: { label: string; value: number }[]; height?: number; label: string; format: (n: number) => string }) {
  const W = 640, H = height, padL = 48, padB = 24, padT = 8;
  const max = niceMax(Math.max(1, ...points.map((p) => p.value)));
  const innerW = W - padL, innerH = H - padT - padB;
  const xy = points.map((p, i) => [padL + (i / Math.max(1, points.length - 1)) * innerW, padT + innerH * (1 - p.value / max)] as const);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${d} L${padL + innerW},${padT + innerH} L${padL},${padT + innerH} Z`;
  const labelsAt = [0, Math.floor(points.length / 3), Math.floor((2 * points.length) / 3), points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
      {[0, 0.5, 1].map((t) => {
        const y = padT + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={padL} x2={W} y1={y} y2={y} stroke="var(--line)" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)">{format(max * t)}</text>
          </g>
        );
      })}
      <path d={area} fill="var(--brand-tint)" opacity={0.7} />
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" />
      {labelsAt.map((i) => (
        <text key={i} x={xy[i][0]} y={H - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize={11} fill="var(--ink-3)">{points[i].label}</text>
      ))}
    </svg>
  );
}

/** Horizontal bars for ranked lists in reports. */
export function HBars({ rows, format, tone = 'brand' }: { rows: { label: string; value: number; sub?: string }[]; format: (n: number) => string; tone?: 'brand' | 'info' | Band }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const color = tone === 'brand' ? 'var(--brand)' : tone === 'info' ? 'var(--info)' : BAND_VAR[tone];
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-ink" title={r.label}>{r.label}</span>
          <span className="h-2 overflow-hidden rounded-pill bg-surface-2">
            <span className="block h-full rounded-pill" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </span>
          <span className={cx('num w-24 text-right text-ink-2')}>{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Legend({ items }: { items: { label: string; band: Band }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
      {items.map((it) => (
        <span key={it.band} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: BAND_VAR[it.band] }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
