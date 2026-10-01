import type { AlertState, Batch, Location, Medicine, POLine, Profile, PurchaseOrder, Settings, StockMovement, Supplier } from '../types.ts';

// Row shapes match supabase/migrations. Kept explicit so a schema change fails typecheck in one place.
type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));
const num = (v: unknown) => Number(v ?? 0);

export const fromRow = {
  settings: (r: Row): Settings => ({
    pharmacyName: String(r.pharmacy_name), currency: String(r.currency), bandCriticalDays: num(r.band_critical_days),
    bandSoonDays: num(r.band_soon_days), defaultReorderLevel: num(r.default_reorder_level),
  }),
  location: (r: Row): Location => ({ id: String(r.id), name: String(r.name), kind: r.kind as Location['kind'] }),
  medicine: (r: Row): Medicine => ({
    id: String(r.id), name: String(r.name), genericName: String(r.generic_name ?? ''), strength: String(r.strength ?? ''), form: String(r.form ?? ''),
    packSize: num(r.pack_size), category: String(r.category ?? ''), barcode: String(r.barcode ?? ''), storage: r.storage as Medicine['storage'],
    schedule: r.schedule as Medicine['schedule'], reorderLevel: num(r.reorder_level), locationId: s(r.location_id), isActive: Boolean(r.is_active),
    createdAt: String(r.created_at),
  }),
  batch: (r: Row): Batch => ({
    id: String(r.id), medicineId: String(r.medicine_id), supplierId: s(r.supplier_id), lotNumber: String(r.lot_number), expiryDate: String(r.expiry_date),
    qtyOnHand: num(r.qty_on_hand), unitCost: num(r.unit_cost), unitPrice: num(r.unit_price), receivedAt: String(r.received_at),
    invoiceRef: s(r.invoice_ref), locationId: s(r.location_id), status: r.status as Batch['status'],
  }),
  movement: (r: Row): StockMovement => ({
    id: String(r.id), batchId: String(r.batch_id), type: r.type as StockMovement['type'], qty: num(r.qty), reason: s(r.reason),
    reference: s(r.reference), userId: s(r.user_id), createdAt: String(r.created_at),
  }),
  supplier: (r: Row): Supplier => ({
    id: String(r.id), name: String(r.name), contactName: String(r.contact_name ?? ''), phone: String(r.phone ?? ''), email: String(r.email ?? ''),
    address: String(r.address ?? ''), leadTimeDays: num(r.lead_time_days), returnWindowDays: num(r.return_window_days),
    paymentTerms: String(r.payment_terms ?? ''), notes: String(r.notes ?? ''), isActive: Boolean(r.is_active), onTimeRate: num(r.on_time_rate),
  }),
  poLine: (r: Row): POLine => ({
    id: String(r.id), poId: String(r.po_id), medicineId: String(r.medicine_id), qtyOrdered: num(r.qty_ordered), qtyReceived: num(r.qty_received), unitCost: num(r.unit_cost),
  }),
  purchaseOrder: (r: Row, lines: POLine[]): PurchaseOrder => ({
    id: String(r.id), number: String(r.number), supplierId: String(r.supplier_id), status: r.status as PurchaseOrder['status'],
    orderedAt: s(r.ordered_at), expectedAt: s(r.expected_at), createdBy: s(r.created_by), createdAt: String(r.created_at), lines,
  }),
  alert: (r: Row): AlertState => ({ key: String(r.key), status: r.status as AlertState['status'], updatedAt: String(r.updated_at), userId: s(r.user_id) }),
  profile: (r: Row): Profile => ({ id: String(r.id), fullName: String(r.full_name ?? ''), email: String(r.email ?? ''), role: r.role as Profile['role'] }),
};

export const toRow = {
  settings: (x: Settings) => ({
    id: 1, pharmacy_name: x.pharmacyName, currency: x.currency, band_critical_days: x.bandCriticalDays, band_soon_days: x.bandSoonDays,
    default_reorder_level: x.defaultReorderLevel,
  }),
  location: (x: Location) => ({ id: x.id, name: x.name, kind: x.kind }),
  medicine: (x: Medicine) => ({
    id: x.id, name: x.name, generic_name: x.genericName, strength: x.strength, form: x.form, pack_size: x.packSize, category: x.category,
    barcode: x.barcode || null, storage: x.storage, schedule: x.schedule, reorder_level: x.reorderLevel, location_id: x.locationId,
    is_active: x.isActive, created_at: x.createdAt,
  }),
  batch: (x: Batch) => ({
    id: x.id, medicine_id: x.medicineId, supplier_id: x.supplierId, lot_number: x.lotNumber, expiry_date: x.expiryDate, qty_on_hand: x.qtyOnHand,
    unit_cost: x.unitCost, unit_price: x.unitPrice, received_at: x.receivedAt, invoice_ref: x.invoiceRef, location_id: x.locationId, status: x.status,
  }),
  movement: (x: StockMovement) => ({
    id: x.id, batch_id: x.batchId, type: x.type, qty: x.qty, reason: x.reason, reference: x.reference, user_id: x.userId, created_at: x.createdAt,
  }),
  supplier: (x: Supplier) => ({
    id: x.id, name: x.name, contact_name: x.contactName, phone: x.phone, email: x.email, address: x.address, lead_time_days: x.leadTimeDays,
    return_window_days: x.returnWindowDays, payment_terms: x.paymentTerms, notes: x.notes, is_active: x.isActive, on_time_rate: x.onTimeRate,
  }),
  purchaseOrder: (x: PurchaseOrder) => ({
    id: x.id, number: x.number, supplier_id: x.supplierId, status: x.status, ordered_at: x.orderedAt, expected_at: x.expectedAt,
    created_by: x.createdBy, created_at: x.createdAt,
  }),
  poLine: (x: POLine) => ({ id: x.id, po_id: x.poId, medicine_id: x.medicineId, qty_ordered: x.qtyOrdered, qty_received: x.qtyReceived, unit_cost: x.unitCost }),
  alert: (x: AlertState) => ({ key: x.key, status: x.status, updated_at: x.updatedAt, user_id: x.userId }),
};
