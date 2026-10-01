/**
 * Business operations as pure functions: (dataset, input) -> ChangeSet.
 * The demo store and the Supabase adapter both apply the resulting change set,
 * so the rules (FEFO, audit trail, PO receiving) live in one place for web and mobile.
 */
import type {
  AlertState, Batch, ChangeSet, Dataset, ID, ISODate, Medicine, POStatus, Profile, PurchaseOrder, Settings, StockMovement, Supplier,
} from './types.ts';
import { daysLeft, fefoPick } from './domain.ts';
import { newId } from './util.ts';

export class OperationError extends Error {}

function movement(batchId: ID, type: StockMovement['type'], qty: number, actor: Profile | null, reason: string | null = null, reference: string | null = null): StockMovement {
  return { id: newId(), batchId, type, qty, reason, reference, userId: actor?.id ?? null, createdAt: new Date().toISOString() };
}

export interface ReceiveLine {
  medicineId: ID;
  supplierId: ID | null;
  lotNumber: string;
  expiryDate: ISODate;
  qty: number;
  unitCost: number;
  unitPrice: number;
  locationId: ID | null;
  poLineId?: ID | null;
}

export interface ReceiveInput {
  invoiceRef: string | null;
  poId?: ID | null;
  lines: ReceiveLine[];
}

export function receiveStock(ds: Dataset, input: ReceiveInput, actor: Profile | null, today: ISODate): ChangeSet {
  if (!input.lines.length) throw new OperationError('Add at least one line to receive.');
  const batches: Batch[] = [];
  const movements: StockMovement[] = [];
  for (const line of input.lines) {
    if (!line.lotNumber.trim()) throw new OperationError('Every line needs a lot number.');
    if (!(line.qty > 0)) throw new OperationError('Quantities must be greater than zero.');
    if (daysLeft({ expiryDate: line.expiryDate }, today) < 0) throw new OperationError(`Lot ${line.lotNumber} is already expired.`);
    const lot = line.lotNumber.trim().toUpperCase();
    // Top up an existing batch with the same lot and expiry, otherwise create one.
    const existing = [...ds.batches, ...batches].find(
      (b) => b.medicineId === line.medicineId && b.lotNumber === lot && b.expiryDate === line.expiryDate && b.status !== 'disposed' && b.status !== 'returned',
    );
    let batch: Batch;
    if (existing) {
      batch = { ...existing, qtyOnHand: existing.qtyOnHand + line.qty, status: existing.status === 'depleted' ? 'active' : existing.status };
      const i = batches.findIndex((b) => b.id === existing.id);
      if (i >= 0) batches[i] = batch; else batches.push(batch);
    } else {
      batch = {
        id: newId(), medicineId: line.medicineId, supplierId: line.supplierId, lotNumber: lot, expiryDate: line.expiryDate,
        qtyOnHand: line.qty, unitCost: line.unitCost, unitPrice: line.unitPrice, receivedAt: new Date().toISOString(),
        invoiceRef: input.invoiceRef, locationId: line.locationId, status: 'active',
      };
      batches.push(batch);
    }
    movements.push(movement(batch.id, 'receive', line.qty, actor, null, input.invoiceRef));
  }

  const cs: ChangeSet = { batches, movements };
  if (input.poId) {
    const po = ds.purchaseOrders.find((p) => p.id === input.poId);
    if (po) {
      const lines = po.lines.map((l) => {
        const got = input.lines.filter((r) => r.poLineId === l.id || (!r.poLineId && r.medicineId === l.medicineId)).reduce((s, r) => s + r.qty, 0);
        return { ...l, qtyReceived: l.qtyReceived + got };
      });
      const complete = lines.every((l) => l.qtyReceived >= l.qtyOrdered);
      cs.purchaseOrders = [{ ...po, lines, status: complete ? 'received' : 'partial' }];
    }
  }
  return cs;
}

export interface DispenseInput {
  medicineId: ID;
  qty: number;
  /** Override FEFO by naming a batch; requires a reason. */
  batchId?: ID | null;
  overrideReason?: string | null;
  reference?: string | null;
}

export function dispense(ds: Dataset, input: DispenseInput, actor: Profile | null, today: ISODate): ChangeSet {
  if (!(input.qty > 0)) throw new OperationError('Enter a quantity greater than zero.');
  const batches: Batch[] = [];
  const movements: StockMovement[] = [];
  if (input.batchId) {
    if (!input.overrideReason?.trim()) throw new OperationError('Give a reason for overriding FEFO.');
    const b = ds.batches.find((x) => x.id === input.batchId);
    if (!b || b.status !== 'active') throw new OperationError('That batch is not available.');
    if (daysLeft(b, today) < 0) throw new OperationError('Expired stock cannot be dispensed.');
    if (b.qtyOnHand < input.qty) throw new OperationError(`Lot ${b.lotNumber} only has ${b.qtyOnHand} units.`);
    const left = b.qtyOnHand - input.qty;
    batches.push({ ...b, qtyOnHand: left, status: left === 0 ? 'depleted' : b.status });
    movements.push(movement(b.id, 'dispense', -input.qty, actor, `FEFO override: ${input.overrideReason}`, input.reference ?? null));
  } else {
    const { allocations, shortfall } = fefoPick(ds, input.medicineId, input.qty, today);
    if (shortfall > 0) throw new OperationError(`Only ${input.qty - shortfall} in-date units available.`);
    for (const a of allocations) {
      const left = a.batch.qtyOnHand - a.qty;
      batches.push({ ...a.batch, qtyOnHand: left, status: left === 0 ? 'depleted' : a.batch.status });
      movements.push(movement(a.batch.id, 'dispense', -a.qty, actor, null, input.reference ?? null));
    }
  }
  return { batches, movements };
}

export function adjust(ds: Dataset, input: { batchId: ID; delta: number; reason: string }, actor: Profile | null): ChangeSet {
  if (!input.reason.trim()) throw new OperationError('A reason is required for adjustments.');
  if (!input.delta) throw new OperationError('Enter a non-zero adjustment.');
  const b = ds.batches.find((x) => x.id === input.batchId);
  if (!b) throw new OperationError('Batch not found.');
  const qty = b.qtyOnHand + input.delta;
  if (qty < 0) throw new OperationError(`Lot ${b.lotNumber} only has ${b.qtyOnHand} units.`);
  return {
    batches: [{ ...b, qtyOnHand: qty, status: qty === 0 ? 'depleted' : b.status === 'depleted' ? 'active' : b.status }],
    movements: [movement(b.id, 'adjust', input.delta, actor, input.reason)],
  };
}

export type BatchAction = 'quarantine' | 'release' | 'return' | 'dispose' | 'mark_used';

export function changeBatchStatus(
  ds: Dataset,
  input: { batchId: ID; action: BatchAction; reason?: string; method?: string; witness?: string },
  actor: Profile | null,
): ChangeSet {
  const b = ds.batches.find((x) => x.id === input.batchId);
  if (!b) throw new OperationError('Batch not found.');
  const med = ds.medicines.find((m) => m.id === b.medicineId);
  switch (input.action) {
    case 'quarantine':
      return { batches: [{ ...b, status: 'quarantined' }], movements: [movement(b.id, 'transfer', 0, actor, input.reason || 'Moved to quarantine')] };
    case 'release':
      return { batches: [{ ...b, status: 'active' }], movements: [movement(b.id, 'transfer', 0, actor, input.reason || 'Released from quarantine')] };
    case 'return':
      return {
        batches: [{ ...b, status: 'returned', qtyOnHand: 0 }],
        movements: [movement(b.id, 'return', -b.qtyOnHand, actor, input.reason || 'Returned to supplier')],
      };
    case 'dispose': {
      if (med?.schedule === 'controlled' && !input.witness?.trim()) throw new OperationError('Controlled drugs need a witness to dispose.');
      const reason = [input.reason || 'Disposed', input.method && `method: ${input.method}`, input.witness && `witness: ${input.witness}`].filter(Boolean).join(' · ');
      return { batches: [{ ...b, status: 'disposed', qtyOnHand: 0 }], movements: [movement(b.id, 'dispose', -b.qtyOnHand, actor, reason)] };
    }
    case 'mark_used':
      return {
        batches: [{ ...b, status: 'depleted', qtyOnHand: 0 }],
        movements: [movement(b.id, 'dispense', -b.qtyOnHand, actor, input.reason || 'Marked as sold/used')],
      };
  }
}

export function setAlertStatus(key: string, status: AlertState['status'], actor: Profile | null): ChangeSet {
  return { alertStates: [{ key, status, updatedAt: new Date().toISOString(), userId: actor?.id ?? null }] };
}

export function saveMedicine(input: Omit<Medicine, 'id' | 'createdAt'> & { id?: ID; createdAt?: string }): ChangeSet {
  if (!input.name.trim()) throw new OperationError('Name is required.');
  return { medicines: [{ ...input, id: input.id ?? newId(), createdAt: input.createdAt ?? new Date().toISOString() }] };
}

export function saveSupplier(input: Omit<Supplier, 'id' | 'onTimeRate'> & { id?: ID; onTimeRate?: number }): ChangeSet {
  if (!input.name.trim()) throw new OperationError('Supplier name is required.');
  return { suppliers: [{ ...input, id: input.id ?? newId(), onTimeRate: input.onTimeRate ?? 1 }] };
}

export function nextPoNumber(ds: Dataset): string {
  const max = ds.purchaseOrders.reduce((m, p) => Math.max(m, Number(p.number.replace(/\D/g, '')) || 0), 1000);
  return `PO-${max + 1}`;
}

export function savePurchaseOrder(ds: Dataset, po: Omit<PurchaseOrder, 'id' | 'number' | 'createdAt'> & { id?: ID; number?: string; createdAt?: string }): ChangeSet {
  if (!po.supplierId) throw new OperationError('Choose a supplier.');
  if (!po.lines.length) throw new OperationError('Add at least one medicine.');
  const id = po.id ?? newId();
  return {
    purchaseOrders: [{
      ...po,
      id,
      number: po.number ?? nextPoNumber(ds),
      createdAt: po.createdAt ?? new Date().toISOString(),
      lines: po.lines.map((l) => ({ ...l, id: l.id || newId(), poId: id })),
    }],
  };
}

export function setPurchaseOrderStatus(ds: Dataset, id: ID, status: POStatus): ChangeSet {
  const po = ds.purchaseOrders.find((p) => p.id === id);
  if (!po) throw new OperationError('Order not found.');
  return { purchaseOrders: [{ ...po, status, orderedAt: status === 'sent' && !po.orderedAt ? new Date().toISOString() : po.orderedAt }] };
}

export function updateSettings(ds: Dataset, patch: Partial<Settings>): ChangeSet {
  const s = { ...ds.settings, ...patch };
  if (s.bandCriticalDays < 1 || s.bandSoonDays <= s.bandCriticalDays) throw new OperationError('"Soon" must be longer than "Critical".');
  return { settings: s };
}

/** Apply a change set to an in-memory dataset (upsert by id). */
export function applyChangeSet(ds: Dataset, cs: ChangeSet): Dataset {
  const upsert = <T extends { id: string }>(list: T[], items?: T[]) => {
    if (!items?.length) return list;
    const map = new Map(list.map((x) => [x.id, x]));
    for (const it of items) map.set(it.id, it);
    return [...map.values()];
  };
  const alertStates = cs.alertStates?.length
    ? [...ds.alertStates.filter((a) => !cs.alertStates!.some((n) => n.key === a.key)), ...cs.alertStates]
    : ds.alertStates;
  return {
    ...ds,
    settings: cs.settings ?? ds.settings,
    locations: upsert(ds.locations, cs.locations),
    medicines: upsert(ds.medicines, cs.medicines),
    batches: upsert(ds.batches, cs.batches),
    movements: cs.movements?.length ? [...ds.movements, ...cs.movements] : ds.movements,
    suppliers: upsert(ds.suppliers, cs.suppliers),
    purchaseOrders: upsert(ds.purchaseOrders, cs.purchaseOrders),
    alertStates,
  };
}
