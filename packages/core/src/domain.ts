import type {
  AlertState, Band, Batch, Dataset, ID, ISODate, Medicine, PurchaseOrder, Role, Settings, StockMovement, Supplier,
} from './types.ts';
import { addMonths, daysBetween, monthKey, parseISODate } from './util.ts';

// ---------- Expiry bands ----------

export const BANDS: { key: Band; label: string }[] = [
  { key: 'expired', label: 'Expired' },
  { key: 'critical', label: 'Expires ≤ 30d' },
  { key: 'soon', label: 'Expires 31–90d' },
  { key: 'ok', label: 'In date' },
];

export function bandLabel(band: Band, settings?: Settings): string {
  if (!settings) return BANDS.find((b) => b.key === band)!.label;
  switch (band) {
    case 'expired': return 'Expired';
    case 'critical': return `Expires ≤ ${settings.bandCriticalDays}d`;
    case 'soon': return `Expires ${settings.bandCriticalDays + 1}–${settings.bandSoonDays}d`;
    case 'ok': return 'In date';
  }
}

export function bandFor(daysLeft: number, settings: Settings): Band {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= settings.bandCriticalDays) return 'critical';
  if (daysLeft <= settings.bandSoonDays) return 'soon';
  return 'ok';
}

export function daysLeft(batch: Pick<Batch, 'expiryDate'>, today: ISODate): number {
  return daysBetween(today, batch.expiryDate);
}

// ---------- Stock ----------

export type StockStatus = 'out' | 'low' | 'in';

export function activeBatches(ds: Dataset, medicineId: ID): Batch[] {
  return ds.batches
    .filter((b) => b.medicineId === medicineId && b.status === 'active' && b.qtyOnHand > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

/** Batches for a medicine in FEFO order (all statuses), for the detail screen. */
export function batchesFEFO(ds: Dataset, medicineId: ID): Batch[] {
  return ds.batches
    .filter((b) => b.medicineId === medicineId)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export function onHand(ds: Dataset, medicineId: ID): number {
  return activeBatches(ds, medicineId).reduce((s, b) => s + b.qtyOnHand, 0);
}

export function stockStatus(qty: number, reorderLevel: number): StockStatus {
  if (qty <= 0) return 'out';
  if (qty <= reorderLevel) return 'low';
  return 'in';
}

export interface MedicineSummary {
  medicine: Medicine;
  onHand: number;
  packs: number;
  status: StockStatus;
  nearest: Batch | null;
  nearestDays: number | null;
  band: Band | null;
  costValue: number;
  retailValue: number;
  batchCount: number;
}

export function summarizeMedicine(ds: Dataset, m: Medicine, today: ISODate): MedicineSummary {
  const batches = activeBatches(ds, m.id);
  const qty = batches.reduce((s, b) => s + b.qtyOnHand, 0);
  const nearest = batches[0] ?? null;
  const nd = nearest ? daysLeft(nearest, today) : null;
  return {
    medicine: m,
    onHand: qty,
    packs: m.packSize > 0 ? Math.floor(qty / m.packSize) : qty,
    status: stockStatus(qty, m.reorderLevel),
    nearest,
    nearestDays: nd,
    band: nd === null ? null : bandFor(nd, ds.settings),
    costValue: batches.reduce((s, b) => s + b.qtyOnHand * b.unitCost, 0),
    retailValue: batches.reduce((s, b) => s + b.qtyOnHand * b.unitPrice, 0),
    batchCount: batches.length,
  };
}

export function medicineSummaries(ds: Dataset, today: ISODate): MedicineSummary[] {
  return ds.medicines.filter((m) => m.isActive).map((m) => summarizeMedicine(ds, m, today));
}

// ---------- FEFO ----------

export interface Allocation { batch: Batch; qty: number }

/**
 * First expiry, first out. Picks from active, in-date batches with the nearest expiry first.
 * Returns the allocations and any shortfall.
 */
export function fefoPick(ds: Dataset, medicineId: ID, qty: number, today: ISODate): { allocations: Allocation[]; shortfall: number } {
  const allocations: Allocation[] = [];
  let remaining = qty;
  for (const b of activeBatches(ds, medicineId)) {
    if (remaining <= 0) break;
    if (daysLeft(b, today) < 0) continue; // never dispense expired stock
    const take = Math.min(b.qtyOnHand, remaining);
    allocations.push({ batch: b, qty: take });
    remaining -= take;
  }
  return { allocations, shortfall: Math.max(0, remaining) };
}

// ---------- Alerts (computed on read) ----------

export type AlertKind = 'expiry' | 'low_stock' | 'out_of_stock';

export interface Alert {
  key: string;
  kind: AlertKind;
  band: Band | null;
  medicine: Medicine;
  batch: Batch | null;
  daysLeft: number | null;
  value: number;
  status: 'open' | 'acknowledged' | 'resolved';
  title: string;
}

export function computeAlerts(ds: Dataset, today: ISODate): Alert[] {
  const states = new Map<string, AlertState>(ds.alertStates.map((s) => [s.key, s]));
  const meds = new Map(ds.medicines.map((m) => [m.id, m]));
  const out: Alert[] = [];

  for (const b of ds.batches) {
    if (b.status !== 'active' || b.qtyOnHand <= 0) continue;
    const d = daysLeft(b, today);
    const band = bandFor(d, ds.settings);
    if (band === 'ok') continue;
    const m = meds.get(b.medicineId);
    if (!m) continue;
    const key = `expiry:${b.id}:${band}`;
    out.push({
      key, kind: 'expiry', band, medicine: m, batch: b, daysLeft: d,
      value: b.qtyOnHand * b.unitCost,
      status: states.get(key)?.status ?? 'open',
      title: band === 'expired' ? `${m.name} lot ${b.lotNumber} has expired` : `${m.name} lot ${b.lotNumber} expires in ${d} days`,
    });
  }

  for (const m of ds.medicines) {
    if (!m.isActive) continue;
    const qty = onHand(ds, m.id);
    const st = stockStatus(qty, m.reorderLevel);
    if (st === 'in') continue;
    const kind: AlertKind = st === 'out' ? 'out_of_stock' : 'low_stock';
    const key = `${kind}:${m.id}`;
    out.push({
      key, kind, band: null, medicine: m, batch: null, daysLeft: null, value: 0,
      status: states.get(key)?.status ?? 'open',
      title: st === 'out' ? `${m.name} is out of stock` : `${m.name} is low (${qty} left, reorder at ${m.reorderLevel})`,
    });
  }

  const rank = (a: Alert) =>
    a.kind === 'expiry' ? ({ expired: 0, critical: 1, soon: 3, ok: 9 } as const)[a.band!] : a.kind === 'out_of_stock' ? 1.5 : 2;
  return out.sort((a, b) => rank(a) - rank(b) || (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
}

// ---------- Dashboard ----------

export interface Kpis {
  stockValue: number;
  retailValue: number;
  lowCount: number;
  outCount: number;
  expiring30Count: number;
  expiring30Value: number;
  expiredCount: number;
  expiredValue: number;
  skuCount: number;
}

export function kpis(ds: Dataset, today: ISODate): Kpis {
  const sums = medicineSummaries(ds, today);
  const k: Kpis = {
    stockValue: 0, retailValue: 0, lowCount: 0, outCount: 0,
    expiring30Count: 0, expiring30Value: 0, expiredCount: 0, expiredValue: 0, skuCount: sums.length,
  };
  for (const s of sums) {
    k.stockValue += s.costValue;
    k.retailValue += s.retailValue;
    if (s.status === 'low') k.lowCount++;
    if (s.status === 'out') k.outCount++;
  }
  for (const b of ds.batches) {
    if (b.status !== 'active' || b.qtyOnHand <= 0) continue;
    const band = bandFor(daysLeft(b, today), ds.settings);
    const v = b.qtyOnHand * b.unitCost;
    if (band === 'expired') { k.expiredCount++; k.expiredValue += v; }
    if (band === 'critical') { k.expiring30Count++; k.expiring30Value += v; }
  }
  return k;
}

export interface OutlookBucket {
  key: string; // 'expired' or YYYY-MM
  label: string;
  values: Record<Band, number>;
  counts: Record<Band, number>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

/** Value at risk per month for the next `months` months, stacked by band, plus an "Expired" bucket. */
export function expiryOutlook(ds: Dataset, today: ISODate, months = 6): OutlookBucket[] {
  const zero = () => ({ expired: 0, critical: 0, soon: 0, ok: 0 });
  const buckets: OutlookBucket[] = [{ key: 'expired', label: 'Expired', values: zero(), counts: zero() }];
  for (let i = 0; i < months; i++) {
    const k = monthKey(addMonths(today.slice(0, 7) + '-01', i));
    buckets.push({ key: k, label: monthLabel(k), values: zero(), counts: zero() });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const b of ds.batches) {
    if (b.status !== 'active' || b.qtyOnHand <= 0) continue;
    const d = daysLeft(b, today);
    const band = bandFor(d, ds.settings);
    const bucket = d < 0 ? byKey.get('expired') : byKey.get(monthKey(b.expiryDate));
    if (!bucket) continue;
    bucket.values[band] += b.qtyOnHand * b.unitCost;
    bucket.counts[band] += 1;
  }
  return buckets;
}

// ---------- Reorder ----------

export interface ReorderSuggestion {
  medicine: Medicine;
  supplier: Supplier | null;
  onHand: number;
  suggestedQty: number;
  unitCost: number;
}

/** Preferred supplier = supplier of the most recent batch. Suggests topping up to 3× reorder level, in whole packs. */
export function reorderSuggestions(ds: Dataset, today: ISODate): ReorderSuggestion[] {
  const suppliers = new Map(ds.suppliers.map((s) => [s.id, s]));
  const openOnOrder = new Map<ID, number>();
  for (const po of ds.purchaseOrders) {
    if (!['draft', 'sent', 'partial'].includes(po.status)) continue;
    for (const l of po.lines) openOnOrder.set(l.medicineId, (openOnOrder.get(l.medicineId) ?? 0) + l.qtyOrdered - l.qtyReceived);
  }
  return medicineSummaries(ds, today)
    .filter((s) => s.status !== 'in')
    .map((s) => {
      const last = ds.batches
        .filter((b) => b.medicineId === s.medicine.id)
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
      const target = s.medicine.reorderLevel * 3;
      const raw = Math.max(0, target - s.onHand - (openOnOrder.get(s.medicine.id) ?? 0));
      const pack = Math.max(1, s.medicine.packSize);
      return {
        medicine: s.medicine,
        supplier: last?.supplierId ? suppliers.get(last.supplierId) ?? null : null,
        onHand: s.onHand,
        suggestedQty: Math.ceil(raw / pack) * pack,
        unitCost: last?.unitCost ?? 0,
      };
    })
    .filter((r) => r.suggestedQty > 0);
}

// ---------- Purchase orders ----------

export function poTotal(po: PurchaseOrder): number {
  return po.lines.reduce((s, l) => s + l.qtyOrdered * l.unitCost, 0);
}

// ---------- Returns ----------

/** True when the supplier still accepts a return of this batch (return window = days before expiry). */
export function canReturnToSupplier(batch: Batch, supplier: Supplier | undefined | null, today: ISODate): boolean {
  if (!supplier) return false;
  return daysLeft(batch, today) >= supplier.returnWindowDays;
}

// ---------- Reports ----------

export function valuationByCategory(ds: Dataset, today: ISODate) {
  const rows = new Map<string, { category: string; skus: number; units: number; cost: number; retail: number }>();
  for (const s of medicineSummaries(ds, today)) {
    const r = rows.get(s.medicine.category) ?? { category: s.medicine.category, skus: 0, units: 0, cost: 0, retail: 0 };
    r.skus++; r.units += s.onHand; r.cost += s.costValue; r.retail += s.retailValue;
    rows.set(r.category, r);
  }
  return [...rows.values()].sort((a, b) => b.cost - a.cost);
}

export function movementsBetween(ds: Dataset, from: ISODate, to: ISODate): StockMovement[] {
  return ds.movements.filter((m) => m.createdAt.slice(0, 10) >= from && m.createdAt.slice(0, 10) <= to);
}

export function wastage(ds: Dataset, from: ISODate, to: ISODate) {
  const batches = new Map(ds.batches.map((b) => [b.id, b]));
  const meds = new Map(ds.medicines.map((m) => [m.id, m]));
  return movementsBetween(ds, from, to)
    .filter((m) => m.type === 'dispose' || m.type === 'return')
    .map((mv) => {
      const b = batches.get(mv.batchId);
      const med = b ? meds.get(b.medicineId) : undefined;
      return { movement: mv, batch: b, medicine: med, units: Math.abs(mv.qty), value: Math.abs(mv.qty) * (b?.unitCost ?? 0) };
    })
    .sort((a, b) => b.movement.createdAt.localeCompare(a.movement.createdAt));
}

export function movers(ds: Dataset, today: ISODate, days: number) {
  const from = addDaysISO(today, -days);
  const batches = new Map(ds.batches.map((b) => [b.id, b]));
  const totals = new Map<ID, number>();
  for (const mv of movementsBetween(ds, from, today)) {
    if (mv.type !== 'dispense') continue;
    const b = batches.get(mv.batchId);
    if (!b) continue;
    totals.set(b.medicineId, (totals.get(b.medicineId) ?? 0) + Math.abs(mv.qty));
  }
  return ds.medicines
    .filter((m) => m.isActive)
    .map((m) => ({ medicine: m, units: totals.get(m.id) ?? 0, perDay: (totals.get(m.id) ?? 0) / days, onHand: onHand(ds, m.id) }))
    .sort((a, b) => b.units - a.units);
}

/** Daily on-hand units for a medicine over the last `days`, reconstructed backwards from movements. */
export function stockHistory(ds: Dataset, medicineId: ID, today: ISODate, days = 90): { date: ISODate; qty: number }[] {
  const batchIds = new Set(ds.batches.filter((b) => b.medicineId === medicineId).map((b) => b.id));
  const byDay = new Map<string, number>();
  for (const mv of ds.movements) {
    if (!batchIds.has(mv.batchId)) continue;
    const d = mv.createdAt.slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + mv.qty);
  }
  let qty = onHand(ds, medicineId);
  const out: { date: ISODate; qty: number }[] = [];
  for (let i = 0; i <= days; i++) {
    const d = addDaysISO(today, -i);
    out.push({ date: d, qty: Math.max(0, qty) });
    qty -= byDay.get(d) ?? 0;
  }
  return out.reverse();
}

function addDaysISO(d: ISODate, n: number): ISODate {
  const dt = parseISODate(d);
  dt.setDate(dt.getDate() + n);
  const y = dt.getFullYear();
  return `${y}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// ---------- Permissions ----------

export type Permission = 'receive' | 'dispense' | 'adjust' | 'quarantine' | 'dispose' | 'return' | 'orders' | 'reports' | 'settings' | 'manageMedicines' | 'manageSuppliers';

const PERMS: Record<Role, Permission[]> = {
  admin: ['receive', 'dispense', 'adjust', 'quarantine', 'dispose', 'return', 'orders', 'reports', 'settings', 'manageMedicines', 'manageSuppliers'],
  pharmacist: ['receive', 'dispense', 'adjust', 'quarantine', 'dispose', 'return', 'orders', 'reports', 'manageMedicines', 'manageSuppliers'],
  assistant: ['receive', 'dispense'],
};

export function can(role: Role | undefined, p: Permission): boolean {
  return !!role && PERMS[role].includes(p);
}

// ---------- Formatting ----------

const MONTHS_SHORT = MONTHS;

/** 12 Nov 2026 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = parseISODate(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** 11/2026 — as printed on cartons */
export function formatExpiryShort(iso: string): string {
  return `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatDate(iso.slice(0, 10))}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "23 days", "today", "Expired 12 days ago" */
export function relativeDays(days: number): string {
  if (days < 0) return `Expired ${-days} day${days === -1 ? '' : 's'} ago`;
  if (days === 0) return 'Expires today';
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function formatMoney(amount: number, currency: string, opts: { compact?: boolean } = {}): string {
  const symbol = currency === 'PKR' ? 'Rs' : currency;
  if (opts.compact && Math.abs(amount) >= 1000) {
    const units: [number, string][] = [[1e7, 'Cr'], [1e5, 'L'], [1e3, 'k']];
    const [div, suf] = currency === 'PKR' ? units.find(([d]) => Math.abs(amount) >= d)! : Math.abs(amount) >= 1e6 ? [1e6, 'M'] : [1e3, 'k'];
    return `${symbol} ${(amount / div).toFixed(amount / div >= 100 ? 0 : 1)}${suf}`;
  }
  return `${symbol} ${amount.toLocaleString('en-US', { maximumFractionDigits: amount < 100 ? 2 : 0, minimumFractionDigits: 0 })}`;
}

export function formatQty(n: number): string {
  return n.toLocaleString('en-US');
}

export const STORAGE_LABEL = { room: 'Room temp', cold: 'Cold chain 2–8 °C', controlled: 'Controlled' } as const;
export const SCHEDULE_LABEL = { otc: 'OTC', rx: 'Rx', controlled: 'Controlled' } as const;
export const MOVEMENT_LABEL = { receive: 'Received', dispense: 'Dispensed', adjust: 'Adjusted', transfer: 'Transferred', return: 'Returned', dispose: 'Disposed' } as const;
export const PO_STATUS_LABEL = { draft: 'Draft', sent: 'Sent', partial: 'Partly received', received: 'Received', cancelled: 'Cancelled' } as const;
export const ROLE_LABEL = { admin: 'Admin', pharmacist: 'Pharmacist', assistant: 'Assistant' } as const;
