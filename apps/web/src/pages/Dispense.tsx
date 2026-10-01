import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRightLeft, Info, SlidersHorizontal } from 'lucide-react';
import { activeBatches, adjust, bandFor, can, daysLeft, dispense, fefoPick, onHand } from '@medistock/core';
import { useData } from '../lib/store';
import { BandPill, Button, Card, EmptyState, Input, LotLabel, PageHeader, Select, Tabs } from '../components/ui';
import { MedicinePicker } from '../components/MedicinePicker';

export default function Dispense() {
  const { ds, user } = useData();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'dispense' | 'adjust'>(params.get('tab') === 'adjust' ? 'adjust' : 'dispense');
  const [medId, setMedId] = useState<string | null>(params.get('med'));
  const med = ds.medicines.find((m) => m.id === medId);
  const tabs = [{ value: 'dispense' as const, label: 'Dispense' }, ...(can(user.role, 'adjust') ? [{ value: 'adjust' as const, label: 'Adjust' }] : [])];

  return (
    <div className="animate-rise">
      <PageHeader title="Dispense & adjust" subtitle="Stock leaves first-expiry-first-out. The batch to pick is chosen for you." />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card padded={false}>
          <div className="px-5 pt-2"><Tabs label="Mode" value={tab} onChange={setTab} items={tabs} /></div>
          <div className="p-5">
            <MedicinePicker value={medId} onChange={setMedId} autoFocus={!medId} />
            {med ? (tab === 'dispense' ? <DispenseForm key={med.id} medicineId={med.id} /> : <AdjustForm key={med.id} medicineId={med.id} />) : (
              <EmptyState icon={<ArrowRightLeft size={22} />} title="Choose a medicine" body="Scan the barcode with a USB scanner or type the name." />
            )}
          </div>
        </Card>
        {med && <BatchesPanel medicineId={med.id} />}
      </div>
    </div>
  );
}

function BatchesPanel({ medicineId }: { medicineId: string }) {
  const { ds, today } = useData();
  const med = ds.medicines.find((m) => m.id === medicineId)!;
  const batches = activeBatches(ds, medicineId);
  return (
    <Card title={<>Batches on hand <span className="num text-sm font-normal text-ink-3">{onHand(ds, medicineId)} units</span></>}
      action={<Link to={`/inventory/${med.id}`} className="link text-sm">Medicine detail</Link>} padded={false}>
      {batches.length ? (
        <ul className="divide-y divide-line">
          {batches.map((b, i) => {
            const d = daysLeft(b, today);
            return (
              <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="num w-5 text-sm text-ink-3">{i + 1}</span>
                  <LotLabel lot={b.lotNumber} expiry={b.expiryDate} />
                </div>
                <div className="flex items-center gap-3"><span className="num text-sm text-ink">{b.qtyOnHand}</span><BandPill band={bandFor(d, ds.settings)} days={d} /></div>
              </li>
            );
          })}
        </ul>
      ) : <EmptyState icon={<Info size={22} />} title="No active batches" />}
    </Card>
  );
}

function DispenseForm({ medicineId }: { medicineId: string }) {
  const { ds, today, run } = useData();
  const [qty, setQty] = useState(0);
  const [ref, setRef] = useState('');
  const [override, setOverride] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [reason, setReason] = useState('');
  const pick = useMemo(() => fefoPick(ds, medicineId, qty, today), [ds, medicineId, qty, today]);
  const inDate = activeBatches(ds, medicineId).filter((b) => daysLeft(b, today) >= 0);

  const submit = async () => {
    const ok = await run((d, u, t) => dispense(d, { medicineId, qty, reference: ref || null, batchId: override ? batchId : null, overrideReason: override ? reason : null }, u, t),
      `Dispensed ${qty} unit${qty === 1 ? '' : 's'}.`);
    if (ok) { setQty(0); setRef(''); setOverride(false); setReason(''); }
  };

  return (
    <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Quantity (units)" type="number" min={1} mono value={qty || ''} onChange={(e) => setQty(Number(e.target.value))} />
        <Input label="Reference" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Rx or sale number (optional)" />
      </div>
      {qty > 0 && !override && (
        <div className="rounded-md border border-line bg-surface-2 p-4">
          <div className="label mb-2">FEFO pick</div>
          {pick.allocations.length ? (
            <ul className="space-y-2">
              {pick.allocations.map((a) => (
                <li key={a.batch.id} className="flex items-center justify-between text-sm">
                  <LotLabel lot={a.batch.lotNumber} expiry={a.batch.expiryDate} />
                  <span className="num text-ink">−{a.qty}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {pick.shortfall > 0 && <p className="mt-2 text-sm text-expired">Short by {pick.shortfall} units of in-date stock.</p>}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" /> Pick a specific batch instead (needs a reason)
      </label>
      {override && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Batch" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">Choose a batch</option>
            {inDate.map((b) => <option key={b.id} value={b.id}>{b.lotNumber} · exp {b.expiryDate} · {b.qtyOnHand} units</option>)}
          </Select>
          <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Patient brought own lot" />
        </div>
      )}
      <Button type="submit" variant="primary" icon={<ArrowRightLeft size={16} />} disabled={!qty || (!override && pick.shortfall > 0) || (override && (!batchId || !reason.trim()))}>
        Dispense {qty || ''}
      </Button>
    </form>
  );
}

function AdjustForm({ medicineId }: { medicineId: string }) {
  const { ds, run } = useData();
  const batches = ds.batches.filter((b) => b.medicineId === medicineId && (b.status === 'active' || b.status === 'quarantined' || b.status === 'depleted'));
  const [batchId, setBatchId] = useState(batches[0]?.id ?? '');
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');
  const b = batches.find((x) => x.id === batchId);
  const submit = async () => {
    const ok = await run((d, u) => adjust(d, { batchId, delta, reason }, u), 'Adjustment recorded.');
    if (ok) { setDelta(0); setReason(''); }
  };
  return (
    <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Select label="Batch" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
        {batches.map((x) => <option key={x.id} value={x.id}>{x.lotNumber} · exp {x.expiryDate} · {x.qtyOnHand} units</option>)}
      </Select>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Change in units" type="number" mono value={delta || ''} onChange={(e) => setDelta(Number(e.target.value))}
          help={b ? `New quantity: ${Math.max(0, b.qtyOnHand + delta)}` : undefined} />
        <Select label="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Choose a reason</option>
          <option>Stock count correction</option><option>Damaged</option><option>Found during count</option><option>Theft or loss</option><option>Sample given</option>
        </Select>
      </div>
      <Button type="submit" variant="primary" icon={<SlidersHorizontal size={16} />} disabled={!batchId || !delta || !reason}>Record adjustment</Button>
    </form>
  );
}
