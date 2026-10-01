import type { ISODate } from './types.ts';

export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // RFC4122-ish fallback for runtimes without crypto.randomUUID (older React Native).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const DAY = 86_400_000;

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function addMonths(date: ISODate, months: number): ISODate {
  const d = parseISODate(date);
  d.setMonth(d.getMonth() + months);
  return toISODate(d);
}

/** Whole days from `from` to `to` (both ISO dates); negative when `to` is earlier. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / DAY);
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function monthKey(date: ISODate): string {
  return date.slice(0, 7);
}
