export type ID = string;
/** ISO date (YYYY-MM-DD) */
export type ISODate = string;
/** ISO timestamp */
export type ISODateTime = string;

export type StorageType = 'room' | 'cold' | 'controlled';
export type Schedule = 'otc' | 'rx' | 'controlled';
export type BatchStatus = 'active' | 'quarantined' | 'returned' | 'disposed' | 'depleted';
export type MovementType = 'receive' | 'dispense' | 'adjust' | 'transfer' | 'return' | 'dispose';
export type POStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';
export type Role = 'admin' | 'pharmacist' | 'assistant';
export type Band = 'expired' | 'critical' | 'soon' | 'ok';
export type LocationKind = 'shelf' | 'fridge' | 'safe';

export interface Location {
  id: ID;
  name: string;
  kind: LocationKind;
}

export interface Medicine {
  id: ID;
  name: string;
  genericName: string;
  strength: string;
  form: string;
  packSize: number;
  category: string;
  barcode: string;
  storage: StorageType;
  schedule: Schedule;
  reorderLevel: number;
  locationId: ID | null;
  isActive: boolean;
  createdAt: ISODateTime;
}

export interface Batch {
  id: ID;
  medicineId: ID;
  supplierId: ID | null;
  lotNumber: string;
  expiryDate: ISODate;
  qtyOnHand: number;
  unitCost: number;
  unitPrice: number;
  receivedAt: ISODateTime;
  invoiceRef: string | null;
  locationId: ID | null;
  status: BatchStatus;
}

export interface StockMovement {
  id: ID;
  batchId: ID;
  type: MovementType;
  /** Signed quantity in units: positive adds stock, negative removes it. */
  qty: number;
  reason: string | null;
  reference: string | null;
  userId: ID | null;
  createdAt: ISODateTime;
}

export interface Supplier {
  id: ID;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  leadTimeDays: number;
  returnWindowDays: number;
  paymentTerms: string;
  notes: string;
  isActive: boolean;
  /** Share of orders delivered by the expected date, 0–1. */
  onTimeRate: number;
}

export interface POLine {
  id: ID;
  poId: ID;
  medicineId: ID;
  qtyOrdered: number;
  qtyReceived: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: ID;
  number: string;
  supplierId: ID;
  status: POStatus;
  orderedAt: ISODateTime | null;
  expectedAt: ISODate | null;
  createdBy: ID | null;
  createdAt: ISODateTime;
  lines: POLine[];
}

export interface Profile {
  id: ID;
  fullName: string;
  email: string;
  role: Role;
}

export interface Settings {
  pharmacyName: string;
  currency: string;
  bandCriticalDays: number;
  bandSoonDays: number;
  defaultReorderLevel: number;
}

/** Persisted state of an alert. Alerts themselves are computed on read from batches and stock. */
export interface AlertState {
  key: string;
  status: 'acknowledged' | 'resolved';
  updatedAt: ISODateTime;
  userId: ID | null;
}

export interface Dataset {
  settings: Settings;
  locations: Location[];
  medicines: Medicine[];
  batches: Batch[];
  movements: StockMovement[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  alertStates: AlertState[];
  profiles: Profile[];
}

/** A set of writes produced by an operation. Both the demo store and Supabase apply the same change set. */
export interface ChangeSet {
  medicines?: Medicine[];
  batches?: Batch[];
  movements?: StockMovement[];
  suppliers?: Supplier[];
  purchaseOrders?: PurchaseOrder[];
  alertStates?: AlertState[];
  settings?: Settings;
  locations?: Location[];
}
