import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSeed } from './demo/seed.ts';
import { bandFor, computeAlerts, expiryOutlook, fefoPick, kpis, onHand, reorderSuggestions } from './domain.ts';
import { adjust, applyChangeSet, changeBatchStatus, dispense, OperationError, receiveStock } from './operations.ts';
import { addDays } from './util.ts';
import type { Dataset, Profile } from './types.ts';

const TODAY = '2026-10-01';
const actor: Profile = { id: 'u1', fullName: 'Test', email: 't@x', role: 'admin' };
const fresh = (): Dataset => generateSeed(TODAY);

test('bands follow settings thresholds', () => {
  const s = fresh().settings;
  assert.equal(bandFor(-1, s), 'expired');
  assert.equal(bandFor(0, s), 'critical');
  assert.equal(bandFor(30, s), 'critical');
  assert.equal(bandFor(31, s), 'soon');
  assert.equal(bandFor(90, s), 'soon');
  assert.equal(bandFor(91, s), 'ok');
});

test('seed populates every band and is deterministic', () => {
  const a = fresh(), b = fresh();
  assert.deepEqual(a.batches.map((x) => x.lotNumber), b.batches.map((x) => x.lotNumber));
  assert.equal(a.medicines.length, 40);
  assert.equal(a.suppliers.length, 6);
  const buckets = expiryOutlook(a, TODAY);
  const k = kpis(a, TODAY);
  assert.ok(k.expiredCount > 0 && k.expiring30Count > 0 && k.lowCount + k.outCount > 0);
  assert.ok(buckets.some((x) => x.values.soon > 0));
});

test('stock history reconciles: receipts minus dispensing equals on hand', () => {
  const ds = fresh();
  for (const b of ds.batches) {
    const net = ds.movements.filter((m) => m.batchId === b.id).reduce((s, m) => s + m.qty, 0);
    assert.equal(net, b.qtyOnHand, `batch ${b.lotNumber}`);
  }
});

test('FEFO picks nearest in-date expiry first and never expired stock', () => {
  const ds = fresh();
  const med = ds.medicines.find((m) => ds.batches.filter((b) => b.medicineId === m.id && b.status === 'active' && b.qtyOnHand > 0).length >= 2)!;
  const total = onHand(ds, med.id);
  const { allocations } = fefoPick(ds, med.id, total, TODAY);
  const dates = allocations.map((a) => a.batch.expiryDate);
  assert.deepEqual(dates, [...dates].sort());
  assert.ok(allocations.every((a) => a.batch.expiryDate >= TODAY));
});

test('dispense writes one movement per batch and decrements stock', () => {
  let ds = fresh();
  const med = ds.medicines.find((m) => fefoPick(ds, m.id, 1, TODAY).shortfall === 0)!;
  const before = onHand(ds, med.id);
  const cs = dispense(ds, { medicineId: med.id, qty: 1 }, actor, TODAY);
  ds = applyChangeSet(ds, cs);
  assert.equal(onHand(ds, med.id), before - 1);
  assert.equal(cs.movements!.length, 1);
  assert.equal(cs.movements![0].qty, -1);
});

test('dispense refuses more than in-date stock', () => {
  const ds = fresh();
  const med = ds.medicines[0];
  assert.throws(() => dispense(ds, { medicineId: med.id, qty: 1_000_000 }, actor, TODAY), OperationError);
});

test('receive tops up a matching lot and creates new ones otherwise', () => {
  let ds = fresh();
  const med = ds.medicines[0];
  const exp = addDays(TODAY, 400);
  const line = { medicineId: med.id, supplierId: null, lotNumber: 'zz100', expiryDate: exp, qty: 50, unitCost: 1, unitPrice: 2, locationId: null };
  ds = applyChangeSet(ds, receiveStock(ds, { invoiceRef: 'INV-1', lines: [line] }, actor, TODAY));
  ds = applyChangeSet(ds, receiveStock(ds, { invoiceRef: 'INV-2', lines: [{ ...line, qty: 25 }] }, actor, TODAY));
  const lots = ds.batches.filter((b) => b.lotNumber === 'ZZ100');
  assert.equal(lots.length, 1);
  assert.equal(lots[0].qtyOnHand, 75);
  assert.throws(() => receiveStock(ds, { invoiceRef: null, lines: [{ ...line, expiryDate: addDays(TODAY, -1) }] }, actor, TODAY), OperationError);
});

test('adjust needs a reason; controlled disposal needs a witness', () => {
  const ds = fresh();
  const b = ds.batches.find((x) => x.status === 'active' && x.qtyOnHand > 0)!;
  assert.throws(() => adjust(ds, { batchId: b.id, delta: -1, reason: ' ' }, actor), OperationError);
  const cd = ds.batches.find((x) => x.status === 'active' && x.qtyOnHand > 0 && ds.medicines.find((m) => m.id === x.medicineId)!.schedule === 'controlled')!;
  assert.throws(() => changeBatchStatus(ds, { batchId: cd.id, action: 'dispose' }, actor), OperationError);
  const cs = changeBatchStatus(ds, { batchId: cd.id, action: 'dispose', witness: 'Sara' }, actor);
  assert.equal(cs.batches![0].status, 'disposed');
  assert.equal(cs.movements![0].qty, -cd.qtyOnHand);
});

test('alerts and reorder suggestions cover low and expiring stock', () => {
  const ds = fresh();
  const alerts = computeAlerts(ds, TODAY);
  assert.ok(alerts.some((a) => a.kind === 'expiry' && a.band === 'expired'));
  assert.ok(alerts.some((a) => a.kind === 'out_of_stock'));
  const sug = reorderSuggestions(ds, TODAY);
  assert.ok(sug.length > 0 && sug.every((s) => s.suggestedQty % Math.max(1, s.medicine.packSize) === 0));
});
