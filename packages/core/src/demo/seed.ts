/**
 * Deterministic demo data: ~40 medicines, ~90 batches spread across every expiry band, 6 suppliers,
 * 90 days of movements and a few purchase orders. Dates are relative to `today` so the bands stay populated.
 * The same generator writes supabase/seed.sql, so demo mode and a fresh Supabase project match.
 */
import type { Batch, Dataset, Location, Medicine, Profile, PurchaseOrder, StockMovement, Supplier, StorageType, Schedule } from '../types.ts';
import { addDays, todayISO } from '../util.ts';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_USERS: (Profile & { password: string })[] = [
  { id: '00000000-0000-4000-8000-000000000001', fullName: 'Ahmed Khan', email: 'admin@medistock.demo', role: 'admin', password: 'demo1234' },
  { id: '00000000-0000-4000-8000-000000000002', fullName: 'Sara Malik', email: 'pharmacist@medistock.demo', role: 'pharmacist', password: 'demo1234' },
  { id: '00000000-0000-4000-8000-000000000003', fullName: 'Bilal Raza', email: 'assistant@medistock.demo', role: 'assistant', password: 'demo1234' },
];

type MedSpec = [name: string, generic: string, strength: string, form: string, pack: number, category: string, storage: StorageType, schedule: Schedule, cost: number, reorder: number, dailyUse: number];

const MEDS: MedSpec[] = [
  ['Panadol', 'Paracetamol', '500 mg', 'Tablet', 20, 'Analgesics', 'room', 'otc', 1.6, 200, 14],
  ['Brufen', 'Ibuprofen', '400 mg', 'Tablet', 30, 'Analgesics', 'room', 'otc', 3.2, 150, 8],
  ['Ponstan Forte', 'Mefenamic acid', '500 mg', 'Tablet', 20, 'Analgesics', 'room', 'rx', 5.4, 80, 4],
  ['Disprin', 'Aspirin', '300 mg', 'Dispersible tablet', 12, 'Analgesics', 'room', 'otc', 1.1, 120, 5],
  ['Tramal', 'Tramadol', '50 mg', 'Capsule', 10, 'Analgesics', 'controlled', 'controlled', 12.5, 40, 1.5],
  ['Morphine Sulfate', 'Morphine', '10 mg/ml', 'Injection', 10, 'Analgesics', 'controlled', 'controlled', 95, 20, 0.6],
  ['Augmentin', 'Amoxicillin + clavulanate', '625 mg', 'Tablet', 6, 'Antibiotics', 'room', 'rx', 42, 60, 3],
  ['Amoxil', 'Amoxicillin', '500 mg', 'Capsule', 20, 'Antibiotics', 'room', 'rx', 8.5, 100, 5],
  ['Zithromax', 'Azithromycin', '500 mg', 'Tablet', 3, 'Antibiotics', 'room', 'rx', 68, 45, 2],
  ['Ciproxin', 'Ciprofloxacin', '500 mg', 'Tablet', 10, 'Antibiotics', 'room', 'rx', 19, 60, 2.5],
  ['Flagyl', 'Metronidazole', '400 mg', 'Tablet', 20, 'Antibiotics', 'room', 'rx', 3.4, 80, 3],
  ['Velosef', 'Cefradine', '500 mg', 'Capsule', 12, 'Antibiotics', 'room', 'rx', 22, 50, 1.5],
  ['Norvasc', 'Amlodipine', '5 mg', 'Tablet', 30, 'Cardiovascular', 'room', 'rx', 9.8, 90, 4],
  ['Concor', 'Bisoprolol', '5 mg', 'Tablet', 30, 'Cardiovascular', 'room', 'rx', 11.2, 90, 3.5],
  ['Lipitor', 'Atorvastatin', '20 mg', 'Tablet', 30, 'Cardiovascular', 'room', 'rx', 24, 90, 4],
  ['Loprin', 'Aspirin (low dose)', '75 mg', 'Tablet', 30, 'Cardiovascular', 'room', 'otc', 1.4, 120, 6],
  ['Plavix', 'Clopidogrel', '75 mg', 'Tablet', 28, 'Cardiovascular', 'room', 'rx', 38, 56, 2],
  ['Lasix', 'Furosemide', '40 mg', 'Tablet', 20, 'Cardiovascular', 'room', 'rx', 2.8, 60, 2],
  ['Glucophage', 'Metformin', '500 mg', 'Tablet', 30, 'Diabetes', 'room', 'rx', 3.1, 150, 9],
  ['Amaryl', 'Glimepiride', '2 mg', 'Tablet', 20, 'Diabetes', 'room', 'rx', 14, 60, 3],
  ['Lantus SoloStar', 'Insulin glargine', '100 IU/ml', 'Pen', 5, 'Diabetes', 'cold', 'rx', 1850, 10, 0.3],
  ['Mixtard 30', 'Insulin human 30/70', '100 IU/ml', 'Vial', 1, 'Diabetes', 'cold', 'rx', 820, 12, 0.4],
  ['Januvia', 'Sitagliptin', '100 mg', 'Tablet', 14, 'Diabetes', 'room', 'rx', 96, 28, 1],
  ['Ventolin Inhaler', 'Salbutamol', '100 mcg', 'Inhaler', 1, 'Respiratory', 'room', 'rx', 310, 15, 0.5],
  ['Seretide Accuhaler', 'Fluticasone + salmeterol', '250/50 mcg', 'Inhaler', 1, 'Respiratory', 'room', 'rx', 2400, 6, 0.15],
  ['Singulair', 'Montelukast', '10 mg', 'Tablet', 14, 'Respiratory', 'room', 'rx', 31, 42, 1.5],
  ['Rigix', 'Cetirizine', '10 mg', 'Tablet', 10, 'Respiratory', 'room', 'otc', 4.5, 80, 4],
  ['Hydryllin Syrup', 'Diphenhydramine + ammonium chloride', '120 ml', 'Syrup', 1, 'Respiratory', 'room', 'otc', 95, 25, 1.2],
  ['Risek', 'Omeprazole', '20 mg', 'Capsule', 14, 'Gastrointestinal', 'room', 'rx', 12, 84, 5],
  ['Nexum', 'Esomeprazole', '40 mg', 'Tablet', 14, 'Gastrointestinal', 'room', 'rx', 17, 56, 3],
  ['Motilium', 'Domperidone', '10 mg', 'Tablet', 30, 'Gastrointestinal', 'room', 'rx', 4.2, 60, 2.5],
  ['ORS Sachet', 'Oral rehydration salts', '27.9 g', 'Sachet', 1, 'Gastrointestinal', 'room', 'otc', 18, 50, 3],
  ['Imodium', 'Loperamide', '2 mg', 'Capsule', 6, 'Gastrointestinal', 'room', 'otc', 9.5, 30, 1],
  ['Surbex-Z', 'Multivitamin + zinc', '30 tabs', 'Tablet', 30, 'Vitamins', 'room', 'otc', 6.8, 90, 4],
  ['CaC-1000 Plus', 'Calcium + vitamin C', '1000 mg', 'Effervescent tablet', 10, 'Vitamins', 'room', 'otc', 21, 40, 2],
  ['Folic Acid', 'Folic acid', '5 mg', 'Tablet', 30, 'Vitamins', 'room', 'otc', 0.9, 90, 3],
  ['Polyfax', 'Polymyxin B + bacitracin', '20 g', 'Ointment', 1, 'Dermatology', 'room', 'otc', 145, 15, 0.4],
  ['Betnovate', 'Betamethasone', '0.1%', 'Cream', 1, 'Dermatology', 'room', 'rx', 110, 15, 0.5],
  ['Xanax', 'Alprazolam', '0.5 mg', 'Tablet', 30, 'CNS', 'controlled', 'controlled', 7.5, 60, 2],
  ['Engerix-B', 'Hepatitis B vaccine', '20 mcg/ml', 'Injection', 1, 'Vaccines', 'cold', 'rx', 640, 10, 0.2],
];

const SUPPLIERS: Omit<Supplier, 'id'>[] = [
  { name: 'Medline Distributors', contactName: 'Imran Siddiqui', phone: '+92 21 3456 7890', email: 'orders@medline.pk', address: 'Plot 14, SITE Area, Karachi', leadTimeDays: 3, returnWindowDays: 90, paymentTerms: 'Net 30', notes: 'Main generalist distributor.', isActive: true, onTimeRate: 0.94 },
  { name: 'Al-Shifa Pharma Traders', contactName: 'Nadia Hussain', phone: '+92 42 3577 1122', email: 'sales@alshifatraders.pk', address: '22 Hall Road, Lahore', leadTimeDays: 2, returnWindowDays: 60, paymentTerms: 'Net 15', notes: 'Good on antibiotics and GI.', isActive: true, onTimeRate: 0.88 },
  { name: 'ColdChain Health', contactName: 'Usman Tariq', phone: '+92 51 2850 4400', email: 'dispatch@coldchainhealth.pk', address: 'I-9 Industrial Area, Islamabad', leadTimeDays: 4, returnWindowDays: 30, paymentTerms: 'Net 30', notes: 'Insulin and vaccines, temperature-logged delivery.', isActive: true, onTimeRate: 0.97 },
  { name: 'CardioMed Supplies', contactName: 'Farah Javed', phone: '+92 21 3567 0091', email: 'farah@cardiomed.pk', address: 'Shahrah-e-Faisal, Karachi', leadTimeDays: 5, returnWindowDays: 120, paymentTerms: 'Net 45', notes: '', isActive: true, onTimeRate: 0.81 },
  { name: 'Respira Pharma', contactName: 'Hamza Qureshi', phone: '+92 42 3520 8833', email: 'orders@respira.pk', address: 'Gulberg III, Lahore', leadTimeDays: 3, returnWindowDays: 90, paymentTerms: 'Net 30', notes: 'Inhalers ship in sealed cartons only.', isActive: true, onTimeRate: 0.9 },
  { name: 'SafeScript CD Logistics', contactName: 'Ayesha Noor', phone: '+92 21 3499 2210', email: 'cd@safescript.pk', address: 'Korangi Industrial Area, Karachi', leadTimeDays: 6, returnWindowDays: 45, paymentTerms: 'Prepaid', notes: 'Controlled drugs; register signature on delivery.', isActive: true, onTimeRate: 0.92 },
];

const CATEGORY_SUPPLIER: Record<string, number> = {
  Analgesics: 0, Antibiotics: 1, Cardiovascular: 3, Diabetes: 0, Respiratory: 4, Gastrointestinal: 1, Vitamins: 0, Dermatology: 1, CNS: 5, Vaccines: 2,
};

export function generateSeed(today: string = todayISO()): Dataset {
  const r = rng(20261001);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  let n = 0;
  const id = (prefix: number) => {
    n++;
    return `${prefix.toString(16).padStart(8, '0')}-${(n >> 12).toString(16).padStart(4, '0')}-4${(n & 0xfff).toString(16).padStart(3, '0')}-8000-${n.toString(16).padStart(12, '0')}`;
  };
  const ts = (date: string, hour = 9 + Math.floor(r() * 9), min = Math.floor(r() * 60)) =>
    new Date(`${date}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`).toISOString();

  const locations: Location[] = [
    ...['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2'].map((s) => ({ id: id(0x10c), name: `Shelf ${s}`, kind: 'shelf' as const })),
    { id: id(0x10c), name: 'Fridge 1', kind: 'fridge' },
    { id: id(0x10c), name: 'Fridge 2', kind: 'fridge' },
    { id: id(0x10c), name: 'CD Safe', kind: 'safe' },
  ];
  const shelves = locations.filter((l) => l.kind === 'shelf');
  const fridges = locations.filter((l) => l.kind === 'fridge');
  const safe = locations.find((l) => l.kind === 'safe')!;

  const suppliers: Supplier[] = SUPPLIERS.map((s) => ({ ...s, id: id(0x5a9) }));

  const medicines: Medicine[] = MEDS.map(([name, generic, strength, form, pack, category, storage, schedule, , reorder], i) => ({
    id: id(0x3ed),
    name, genericName: generic, strength, form, packSize: pack, category, storage, schedule,
    barcode: `896${String(1000000000 + i * 7919 + 123).slice(-9)}${(i * 3) % 10}`,
    reorderLevel: reorder,
    locationId: storage === 'cold' ? fridges[i % 2].id : storage === 'controlled' ? safe.id : shelves[i % shelves.length].id,
    isActive: true,
    createdAt: ts(addDays(today, -400)),
  }));

  // Expiry plan per batch, in days from today. Spread so every band is well populated.
  const bandDays = { expired: () => -Math.floor(3 + r() * 40), critical: () => Math.floor(2 + r() * 28), soon: () => Math.floor(32 + r() * 57), ok: () => Math.floor(95 + r() * 600) };
  const batches: Batch[] = [];
  const movements: StockMovement[] = [];
  const users = DEMO_USERS;

  // Scenario overrides for a realistic mix of statuses.
  const outOfStock = new Set([10, 32]);          // Flagyl, Imodium
  const lowStock = new Set([4, 20, 24, 37, 2]);  // Tramal, Lantus, Seretide, Betnovate, Ponstan

  MEDS.forEach((spec, i) => {
    const m = medicines[i];
    const [, , , , pack, category, , , cost, reorder, daily] = spec;
    const supplier = suppliers[CATEGORY_SUPPLIER[category] ?? 0];
    const count = i % 3 === 0 ? 3 : i % 4 === 1 ? 1 : 2;
    const plan: (keyof typeof bandDays)[] = [];
    for (let k = 0; k < count; k++) {
      const roll = r();
      plan.push(k === 0 ? (roll < 0.14 ? 'expired' : roll < 0.42 ? 'critical' : roll < 0.75 ? 'soon' : 'ok') : roll < 0.15 ? 'soon' : 'ok');
    }
    // A medicine whose only batch is short-dated would read as 'in stock' with nothing usable; give it a fresh batch too.
    if (plan.length === 1 && plan[0] !== 'ok' && !outOfStock.has(i)) plan.push('ok');
    plan.sort((a, b) => ['expired', 'critical', 'soon', 'ok'].indexOf(a) - ['expired', 'critical', 'soon', 'ok'].indexOf(b));

    plan.forEach((band, k) => {
      const expiryOffset = bandDays[band]();
      const receivedOffset = -Math.floor(15 + r() * 100) - k * 6;
      let current = Math.max(pack, Math.round((reorder * (0.5 + r() * 1.2)) / Math.max(1, count - 1 || 1) / pack) * pack);
      if (outOfStock.has(i)) current = 0;
      if (lowStock.has(i)) current = Math.max(0, Math.floor((reorder * 0.6) / count / pack) * pack) || (k === 0 ? pack : 0);
      const unitCost = Math.round(cost * (0.95 + r() * 0.1) * 100) / 100;
      const unitPrice = Math.round(unitCost * 1.18 * 100) / 100;
      const receivedDate = addDays(today, receivedOffset);
      const b: Batch = {
        id: id(0xba7),
        medicineId: m.id,
        supplierId: supplier.id,
        lotNumber: `${String.fromCharCode(65 + Math.floor(r() * 26))}${Math.floor(1000 + r() * 8999)}${String.fromCharCode(65 + Math.floor(r() * 26))}`,
        expiryDate: addDays(today, expiryOffset),
        qtyOnHand: current,
        unitCost,
        unitPrice,
        receivedAt: ts(receivedDate),
        invoiceRef: `INV-${Math.floor(20000 + r() * 9999)}`,
        locationId: m.locationId,
        status: current === 0 ? 'depleted' : 'active',
      };
      // Dispense history between receipt and today (or expiry), so reports and charts have shape.
      let dispensed = 0;
      const lastDay = Math.min(-1, expiryOffset < 0 ? expiryOffset : -1);
      for (let d = receivedOffset + 1; d <= lastDay; d++) {
        const share = daily / count;
        if (r() > Math.min(0.9, share)) continue;
        const qty = Math.max(1, Math.round(share * (0.6 + r() * 1.4)));
        dispensed += qty;
        movements.push({ id: id(0x307), batchId: b.id, type: 'dispense', qty: -qty, reason: null, reference: null, userId: pick(users).id, createdAt: ts(addDays(today, d)) });
      }
      movements.push({ id: id(0x307), batchId: b.id, type: 'receive', qty: current + dispensed, reason: null, reference: b.invoiceRef, userId: users[1].id, createdAt: b.receivedAt });
      batches.push(b);
    });
  });

  // A little wastage history: two batches disposed, one returned.
  const wasteMeds = [7, 15, 27];
  wasteMeds.forEach((mi, k) => {
    const m = medicines[mi];
    const spec = MEDS[mi];
    const qty = spec[4] * (3 + k * 2);
    const b: Batch = {
      id: id(0xba7), medicineId: m.id, supplierId: suppliers[CATEGORY_SUPPLIER[spec[5]] ?? 0].id,
      lotNumber: `W${4100 + k * 37}X`, expiryDate: addDays(today, -20 - k * 15), qtyOnHand: 0,
      unitCost: spec[8], unitPrice: Math.round(spec[8] * 118) / 100, receivedAt: ts(addDays(today, -300)),
      invoiceRef: `INV-${19000 + k}`, locationId: m.locationId, status: k === 2 ? 'returned' : 'disposed',
    };
    batches.push(b);
    movements.push({ id: id(0x307), batchId: b.id, type: 'receive', qty, reason: null, reference: b.invoiceRef, userId: users[1].id, createdAt: b.receivedAt });
    movements.push({
      id: id(0x307), batchId: b.id, type: k === 2 ? 'return' : 'dispose', qty: -qty,
      reason: k === 2 ? 'Returned to supplier for credit' : 'Expired · method: pharmaceutical waste bin · witness: Sara Malik',
      reference: null, userId: users[0].id, createdAt: ts(addDays(today, -12 - k * 9)),
    });
  });

  // Purchase orders.
  const po = (supplierIdx: number, status: PurchaseOrder['status'], daysAgo: number, lines: [number, number, number][]): PurchaseOrder => {
    const pid = id(0x9a0);
    return {
      id: pid, number: `PO-${1040 + purchaseOrders.length + 1}`, supplierId: suppliers[supplierIdx].id, status,
      orderedAt: status === 'draft' ? null : ts(addDays(today, -daysAgo)),
      expectedAt: addDays(today, -daysAgo + suppliers[supplierIdx].leadTimeDays),
      createdBy: users[1].id, createdAt: ts(addDays(today, -daysAgo - 1)),
      lines: lines.map(([mi, qty, got]) => ({ id: id(0x91e), poId: pid, medicineId: medicines[mi].id, qtyOrdered: qty, qtyReceived: got, unitCost: MEDS[mi][8] })),
    };
  };
  const purchaseOrders: PurchaseOrder[] = [];
  purchaseOrders.push(po(0, 'received', 34, [[0, 400, 400], [18, 300, 300], [33, 180, 180]]));
  purchaseOrders.push(po(1, 'received', 21, [[7, 200, 200], [28, 140, 140]]));
  purchaseOrders.push(po(3, 'partial', 6, [[12, 180, 180], [14, 180, 90], [16, 112, 0]]));
  purchaseOrders.push(po(2, 'sent', 2, [[20, 20, 0], [39, 10, 0]]));
  purchaseOrders.push(po(5, 'draft', 0, [[4, 60, 0]]));

  return {
    settings: { pharmacyName: 'Shifa Community Pharmacy', currency: 'PKR', bandCriticalDays: 30, bandSoonDays: 90, defaultReorderLevel: 50 },
    locations, medicines, batches,
    movements: movements.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    suppliers, purchaseOrders, alertStates: [],
    profiles: DEMO_USERS.map(({ password: _p, ...u }) => u),
  };
}
