import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, Pencil, Phone, Plus, Truck } from 'lucide-react';
import {
  can, formatDate, formatDateTime, onHand, poTotal, saveSupplier, type PurchaseOrder, type Supplier,
} from '@medistock/core';
import { useData } from '../lib/store';
import { useMoney } from '../lib/format';
import { Button, ButtonLink, Card, cx, EmptyState, Input, LotLabel, Modal, PageHeader, Stat, Tabs } from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { PoStatus } from './PurchaseOrders';

function SupplierForm({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const { run } = useData();
  const [d, setD] = useState<Omit<Supplier, 'id' | 'onTimeRate'> & { id?: string; onTimeRate?: number }>(supplier ?? {
    name: '', contactName: '', phone: '', email: '', address: '', leadTimeDays: 3, returnWindowDays: 90, paymentTerms: 'Net 30', notes: '', isActive: true,
  });
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((x) => ({ ...x, [k]: v }));
  const save = async () => { if (await run(() => saveSupplier(d), supplier ? 'Supplier updated.' : 'Supplier added.')) onClose(); };
  return (
    <Modal open onClose={onClose} title={supplier ? `Edit ${supplier.name}` : 'Add supplier'} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={!d.name.trim()}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" value={d.name} onChange={(e) => set('name', e.target.value)} />
        <Input label="Contact person" value={d.contactName} onChange={(e) => set('contactName', e.target.value)} />
        <Input label="Phone" type="tel" value={d.phone} onChange={(e) => set('phone', e.target.value)} />
        <Input label="Email" type="email" value={d.email} onChange={(e) => set('email', e.target.value)} />
        <Input label="Address" className="sm:col-span-2" value={d.address} onChange={(e) => set('address', e.target.value)} />
        <Input label="Lead time (days)" type="number" min={0} mono value={d.leadTimeDays} onChange={(e) => set('leadTimeDays', Number(e.target.value))} />
        <Input label="Return window (days before expiry)" type="number" min={0} mono value={d.returnWindowDays} onChange={(e) => set('returnWindowDays', Number(e.target.value))} />
        <Input label="Payment terms" value={d.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} />
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink"><input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={d.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Active supplier</label>
        <Input label="Notes" className="sm:col-span-2" value={d.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
    </Modal>
  );
}

function OnTime({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const tone = pct >= 90 ? 'bg-ok' : pct >= 80 ? 'bg-soon' : 'bg-critical';
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-pill bg-surface-2"><span className={cx('block h-full', tone)} style={{ width: `${pct}%` }} /></span>
      <span className="num text-sm text-ink">{pct}%</span>
    </div>
  );
}

export function SupplierList() {
  const { ds, user } = useData();
  const [adding, setAdding] = useState(false);
  const openPOs = (s: Supplier) => ds.purchaseOrders.filter((p) => p.supplierId === s.id && ['draft', 'sent', 'partial'].includes(p.status)).length;
  const meds = (s: Supplier) => new Set(ds.batches.filter((b) => b.supplierId === s.id).map((b) => b.medicineId)).size;
  const cols: Column<Supplier>[] = [
    { key: 'name', header: 'Supplier', sortValue: (s) => s.name, render: (s) => <div><div className="font-medium text-ink">{s.name}</div><div className="text-sm text-ink-3">{s.contactName}</div></div> },
    { key: 'contact', header: 'Contact', hideBelow: 'lg', render: (s) => <div className="text-sm text-ink-2"><div>{s.phone}</div><div>{s.email}</div></div> },
    { key: 'meds', header: 'Medicines', align: 'right', mono: true, sortValue: meds, render: meds },
    { key: 'lead', header: 'Lead time', align: 'right', mono: true, hideBelow: 'md', sortValue: (s) => s.leadTimeDays, render: (s) => `${s.leadTimeDays} d` },
    { key: 'ret', header: 'Return window', align: 'right', mono: true, hideBelow: 'md', render: (s) => `${s.returnWindowDays} d` },
    { key: 'ontime', header: 'On time', sortValue: (s) => s.onTimeRate, render: (s) => <OnTime rate={s.onTimeRate} /> },
    { key: 'po', header: 'Open POs', align: 'right', mono: true, sortValue: openPOs, render: openPOs },
  ];
  return (
    <div className="animate-rise">
      <PageHeader title="Suppliers" subtitle={`${ds.suppliers.filter((s) => s.isActive).length} active suppliers`}
        actions={can(user.role, 'manageSuppliers') ? <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>Add supplier</Button> : undefined} />
      <Card padded={false}>
        <DataTable caption="Suppliers" rows={ds.suppliers} columns={cols} rowKey={(s) => s.id} rowHref={(s) => `/suppliers/${s.id}`} initialSort={{ key: 'name', dir: 'asc' }}
          empty={<EmptyState icon={<Truck size={22} />} title="No suppliers yet" />} />
      </Card>
      {adding && <SupplierForm onClose={() => setAdding(false)} />}
    </div>
  );
}

export function SupplierDetail() {
  const { id } = useParams();
  const { ds, user, today } = useData();
  const money = useMoney();
  const [tab, setTab] = useState<'overview' | 'medicines' | 'orders' | 'returns'>('overview');
  const [editing, setEditing] = useState(false);
  const s = ds.suppliers.find((x) => x.id === id);
  const data = useMemo(() => {
    if (!s) return null;
    const batches = ds.batches.filter((b) => b.supplierId === s.id);
    const medIds = [...new Set(batches.map((b) => b.medicineId))];
    const ids = new Set(batches.map((b) => b.id));
    const returns = ds.movements.filter((m) => m.type === 'return' && ids.has(m.batchId));
    const deliveries = batches.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 8);
    const orders = ds.purchaseOrders.filter((p) => p.supplierId === s.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { batches, medIds, returns, deliveries, orders };
  }, [ds, s]);
  if (!s || !data) return <EmptyState icon={<Truck size={22} />} title="Supplier not found" action={<ButtonLink to="/suppliers">Back to suppliers</ButtonLink>} />;
  const meds = new Map(ds.medicines.map((m) => [m.id, m]));
  const batchById = new Map(ds.batches.map((b) => [b.id, b]));

  const orderCols: Column<PurchaseOrder>[] = [
    { key: 'n', header: 'Order', render: (p) => <span className="num font-medium text-ink">{p.number}</span> },
    { key: 'st', header: 'Status', render: (p) => <PoStatus status={p.status} /> },
    { key: 'd', header: 'Ordered', render: (p) => <span className="text-sm text-ink-2">{p.orderedAt ? formatDate(p.orderedAt.slice(0, 10)) : '—'}</span> },
    { key: 'l', header: 'Lines', align: 'right', mono: true, render: (p) => p.lines.length },
    { key: 't', header: 'Total', align: 'right', mono: true, render: (p) => money(poTotal(p)) },
  ];

  return (
    <div className="animate-rise">
      <PageHeader back={<Link to="/suppliers" className="inline-flex items-center gap-1 text-ink-2 hover:text-ink"><ArrowLeft size={14} /> Suppliers</Link>}
        title={s.name} subtitle={s.address}
        actions={<>
          {can(user.role, 'manageSuppliers') && <Button icon={<Pencil size={16} />} onClick={() => setEditing(true)}>Edit</Button>}
          {can(user.role, 'orders') && <ButtonLink variant="primary" to={`/orders/new?supplier=${s.id}`} icon={<Plus size={16} />}>New order</ButtonLink>}
        </>} />
      <Card padded={false}>
        <div className="px-5 pt-2">
          <Tabs label="Supplier sections" value={tab} onChange={setTab} items={[
            { value: 'overview', label: 'Overview' }, { value: 'medicines', label: 'Medicines', count: data.medIds.length },
            { value: 'orders', label: 'Orders', count: data.orders.length }, { value: 'returns', label: 'Returns', count: data.returns.length },
          ]} />
        </div>
        {tab === 'overview' && (
          <div className="grid gap-8 p-5 lg:grid-cols-[1fr_1.4fr]">
            <dl className="grid grid-cols-2 gap-5">
              <Stat label="Contact" value={s.contactName || '—'} />
              <Stat label="On-time rate" value={<OnTime rate={s.onTimeRate} />} />
              <Stat label="Phone" value={s.phone ? <a className="link inline-flex items-center gap-1" href={`tel:${s.phone}`}><Phone size={14} />{s.phone}</a> : '—'} />
              <Stat label="Email" value={s.email ? <a className="link inline-flex items-center gap-1 break-all" href={`mailto:${s.email}`}><Mail size={14} />{s.email}</a> : '—'} />
              <Stat label="Lead time" value={`${s.leadTimeDays} days`} mono />
              <Stat label="Return window" value={`${s.returnWindowDays} days before expiry`} />
              <Stat label="Payment terms" value={s.paymentTerms || '—'} />
              <Stat label="Status" value={s.isActive ? 'Active' : 'Inactive'} />
              {s.notes && <div className="col-span-2"><Stat label="Notes" value={s.notes} /></div>}
            </dl>
            <div>
              <div className="label mb-3">Last deliveries</div>
              <ul className="divide-y divide-line rounded-md border border-line">
                {data.deliveries.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0"><div className="truncate text-ink">{meds.get(b.medicineId)?.name}</div><LotLabel lot={b.lotNumber} expiry={b.expiryDate} className="mt-0.5" /></div>
                    <span className="shrink-0 text-sm text-ink-3">{formatDate(b.receivedAt.slice(0, 10))}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {tab === 'medicines' && (
          <ul className="divide-y divide-line">
            {data.medIds.map((mid) => { const m = meds.get(mid)!; return (
              <li key={mid} className="flex items-center justify-between px-5 py-3">
                <Link to={`/inventory/${mid}`} className="font-medium text-ink hover:underline">{m.name} <span className="font-normal text-ink-2">{m.strength}</span></Link>
                <span className="num text-sm text-ink-2">{onHand(ds, mid)} on hand</span>
              </li>
            ); })}
          </ul>
        )}
        {tab === 'orders' && <DataTable caption="Orders" rows={data.orders} columns={orderCols} rowKey={(p) => p.id} rowHref={(p) => `/orders/${p.id}`} empty={<EmptyState icon={<Truck size={22} />} title="No orders yet" />} />}
        {tab === 'returns' && (data.returns.length ? (
          <ul className="divide-y divide-line">
            {data.returns.map((r) => { const b = batchById.get(r.batchId)!; return (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div><div className="text-ink">{meds.get(b.medicineId)?.name}</div><LotLabel lot={b.lotNumber} expiry={b.expiryDate} className="mt-0.5" /></div>
                <div className="text-right"><div className="num text-ink">{Math.abs(r.qty)} units · {money(Math.abs(r.qty) * b.unitCost)}</div><div className="text-sm text-ink-3">{formatDateTime(r.createdAt)}</div></div>
              </li>
            ); })}
          </ul>
        ) : <EmptyState icon={<Truck size={22} />} title="No returns to this supplier" />)}
      </Card>
      <p className="mt-3 text-sm text-ink-3">As of {formatDate(today)}.</p>
      {editing && <SupplierForm supplier={s} onClose={() => setEditing(false)} />}
    </div>
  );
}
