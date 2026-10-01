import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRightLeft, Barcode, MapPin, PackagePlus, Pencil, ShieldAlert, Snowflake } from 'lucide-react';
import {
  batchesFEFO, bandFor, can, daysLeft, formatDate, formatDateTime, MOVEMENT_LABEL, SCHEDULE_LABEL, stockHistory, STORAGE_LABEL, summarizeMedicine,
  type Batch, type StockMovement,
} from '@medistock/core';
import { useData } from '../lib/store';
import { useMoney } from '../lib/format';
import { BandPill, ButtonLink, Button, Card, cx, EmptyState, ExpiryRibbon, LotLabel, PageHeader, Stat, StockBadge } from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { LineChart } from '../components/Charts';
import { BatchActionModal, BatchMenu, type ActionKind } from '../components/BatchActions';
import { MedicineForm } from '../components/MedicineForm';

const STATUS_LABEL: Record<Batch['status'], string> = { active: 'Active', quarantined: 'Quarantined', returned: 'Returned', disposed: 'Disposed', depleted: 'Used up' };

export default function MedicineDetail() {
  const { id } = useParams();
  const { ds, today, user } = useData();
  const money = useMoney();
  const [action, setAction] = useState<{ batch: Batch; kind: ActionKind } | null>(null);
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const med = ds.medicines.find((m) => m.id === id);

  const history = useMemo(() => (med ? stockHistory(ds, med.id, today, 90) : []), [ds, med, today]);
  if (!med) return <EmptyState icon={<Barcode size={22} />} title="Medicine not found" action={<ButtonLink to="/inventory">Back to inventory</ButtonLink>} />;

  const s = summarizeMedicine(ds, med, today);
  const batches = batchesFEFO(ds, med.id).filter((b) => showAll || b.status === 'active' || b.status === 'quarantined');
  const batchIds = new Set(ds.batches.filter((b) => b.medicineId === med.id).map((b) => b.id));
  const batchById = new Map(ds.batches.map((b) => [b.id, b]));
  const movements = ds.movements.filter((m) => batchIds.has(m.batchId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const suppliers = [...new Set(ds.batches.filter((b) => b.medicineId === med.id).map((b) => b.supplierId))]
    .map((sid) => ds.suppliers.find((x) => x.id === sid)).filter(Boolean);
  const people = new Map(ds.profiles.map((p) => [p.id, p.fullName]));
  const location = ds.locations.find((l) => l.id === med.locationId);

  const batchCols: Column<Batch>[] = [
    { key: 'lot', header: 'Lot', render: (b) => <LotLabel lot={b.lotNumber} expiry={b.expiryDate} /> },
    {
      key: 'expiry', header: 'Expiry', render: (b) => {
        const d = daysLeft(b, today);
        return (
          <div className="flex items-center gap-3">
            <span className="num text-sm text-ink">{formatDate(b.expiryDate)}</span>
            {b.status === 'active' || b.status === 'quarantined' ? <BandPill band={bandFor(d, ds.settings)} days={d} /> : null}
          </div>
        );
      },
    },
    { key: 'ribbon', header: <span className="sr-only">Expiry ribbon</span>, hideBelow: 'lg', render: (b) => <ExpiryRibbon expiry={b.expiryDate} today={today} settings={ds.settings} /> },
    { key: 'qty', header: 'Qty', align: 'right', mono: true, render: (b) => b.qtyOnHand.toLocaleString() },
    { key: 'cost', header: 'Unit cost', align: 'right', mono: true, hideBelow: 'md', render: (b) => money(b.unitCost) },
    { key: 'supplier', header: 'Supplier', hideBelow: 'lg', render: (b) => <span className="text-sm text-ink-2">{ds.suppliers.find((x) => x.id === b.supplierId)?.name ?? '—'}</span> },
    {
      key: 'status', header: 'Status', render: (b) => (
        <span className={cx('text-sm', b.status === 'quarantined' ? 'font-medium text-critical' : b.status === 'active' ? 'text-ink' : 'text-ink-3')}>{STATUS_LABEL[b.status]}</span>
      ),
    },
    { key: 'act', header: <span className="sr-only">Actions</span>, align: 'right', render: (b) => <BatchMenu batch={b} onPick={(kind) => setAction({ batch: b, kind })} /> },
  ];

  const mvCols: Column<StockMovement>[] = [
    { key: 'when', header: 'When', render: (m) => <span className="num text-sm text-ink-2">{formatDateTime(m.createdAt)}</span> },
    { key: 'type', header: 'Type', render: (m) => MOVEMENT_LABEL[m.type] },
    { key: 'qty', header: 'Qty', align: 'right', mono: true, render: (m) => <span className={m.qty > 0 ? 'text-ok' : ''}>{m.qty > 0 ? `+${m.qty}` : m.qty}</span> },
    { key: 'lot', header: 'Lot', hideBelow: 'md', render: (m) => <LotLabel lot={batchById.get(m.batchId)?.lotNumber ?? '?'} /> },
    { key: 'by', header: 'By', hideBelow: 'md', render: (m) => <span className="text-sm text-ink-2">{(m.userId && people.get(m.userId)) || '—'}</span> },
    { key: 'note', header: 'Note', hideBelow: 'lg', render: (m) => <span className="text-sm text-ink-2">{m.reason ?? m.reference ?? ''}</span> },
  ];

  return (
    <div className="animate-rise">
      <PageHeader
        back={<Link to="/inventory" className="inline-flex items-center gap-1 text-ink-2 hover:text-ink"><ArrowLeft size={14} /> Inventory</Link>}
        title={<>{med.name} <span className="font-body text-xl font-normal text-ink-2">{med.strength}</span></>}
        subtitle={`${med.genericName} · ${med.form} · pack of ${med.packSize}`}
        actions={<>
          {can(user.role, 'manageMedicines') && <Button icon={<Pencil size={16} />} onClick={() => setEditing(true)}>Edit</Button>}
          {can(user.role, 'dispense') && <ButtonLink to={`/dispense?med=${med.id}`} icon={<ArrowRightLeft size={16} />}>Dispense</ButtonLink>}
          {can(user.role, 'receive') && <ButtonLink to={`/receive?med=${med.id}`} variant="primary" icon={<PackagePlus size={16} />}>Receive</ButtonLink>}
        </>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <div className="flex flex-wrap gap-2">
            <StockBadge status={s.status} />
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-2 px-2.5 py-0.5 text-sm text-ink-2">{med.storage === 'cold' && <Snowflake size={13} />}{STORAGE_LABEL[med.storage]}</span>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-2 px-2.5 py-0.5 text-sm text-ink-2">{med.schedule === 'controlled' && <ShieldAlert size={13} />}{SCHEDULE_LABEL[med.schedule]}</span>
          </div>
          <div className="mt-5 flex items-end gap-3">
            <div className="font-display text-3xl font-semibold leading-none">{s.onHand.toLocaleString()}</div>
            <div className="pb-1 text-ink-2">units on hand · {s.packs} packs</div>
          </div>
          {s.nearest && s.band ? (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-ink-2">Next to expire: <LotLabel lot={s.nearest.lotNumber} expiry={s.nearest.expiryDate} /></span>
                <BandPill band={s.band} days={s.nearestDays} />
              </div>
              <ExpiryRibbon size="card" expiry={s.nearest.expiryDate} today={today} settings={ds.settings} />
            </div>
          ) : <p className="mt-5 text-sm text-ink-2">No active stock.</p>}
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5">
            <Stat label="Reorder level" value={med.reorderLevel} mono />
            <Stat label="Value at cost" value={money(s.costValue)} mono />
            <Stat label="Location" value={<span className="inline-flex items-center gap-1"><MapPin size={14} className="text-ink-3" />{location?.name ?? '—'}</span>} />
            <Stat label="Barcode" value={med.barcode || '—'} mono />
            <Stat label="Category" value={med.category} />
            <Stat label="Suppliers" value={suppliers.length ? suppliers.map((x) => <Link key={x!.id} to={`/suppliers/${x!.id}`} className="link block">{x!.name}</Link>) : '—'} />
          </dl>
        </Card>

        <Card title="Stock on hand, last 90 days">
          <LineChart points={history.map((h) => ({ label: formatDate(h.date).replace(/ \d{4}$/, ''), value: h.qty }))} label={`Units on hand for ${med.name} over 90 days`} format={(n) => String(Math.round(n))} height={300} />
        </Card>
      </div>

      <Card className="mt-6" padded={false} title={<>Batches <span className="text-sm font-normal text-ink-3">FEFO order, nearest expiry first</span></>}
        action={<label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show closed batches</label>}>
        <DataTable caption="Batches" rows={batches} columns={batchCols} rowKey={(b) => b.id}
          empty={<EmptyState icon={<PackagePlus size={22} />} title="No batches in stock" action={can(user.role, 'receive') ? <ButtonLink to={`/receive?med=${med.id}`} variant="primary">Receive stock</ButtonLink> : undefined} />} />
      </Card>

      <Card className="mt-6" padded={false} title="Movement history">
        <DataTable caption="Movement history" rows={movements} columns={mvCols} rowKey={(m) => m.id} pageSize={10}
          empty={<EmptyState icon={<ArrowRightLeft size={22} />} title="No movements yet" />} />
      </Card>

      {action && <BatchActionModal batch={action.batch} action={action.kind} onClose={() => setAction(null)} />}
      {editing && <MedicineForm open medicine={med} onClose={() => setEditing(false)} />}
    </div>
  );
}
