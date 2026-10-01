import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { adjust, can, canReturnToSupplier, changeBatchStatus, daysLeft, type Batch, type BatchAction } from '@medistock/core';
import { useData } from '../lib/store';
import { Button, Input, LotLabel, Modal, Select } from './ui';

export type ActionKind = BatchAction | 'adjust';

const TITLES: Record<ActionKind, string> = {
  adjust: 'Adjust quantity', quarantine: 'Move to quarantine', release: 'Release from quarantine', return: 'Return to supplier',
  dispose: 'Dispose of batch', mark_used: 'Mark as sold or used',
};

export function BatchActionModal({ batch, action, onClose }: { batch: Batch; action: ActionKind; onClose: () => void }) {
  const { ds, run, today } = useData();
  const med = ds.medicines.find((m) => m.id === batch.medicineId)!;
  const supplier = ds.suppliers.find((s) => s.id === batch.supplierId);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState(action === 'adjust' ? '' : action === 'dispose' && daysLeft(batch, today) < 0 ? 'Expired' : '');
  const [method, setMethod] = useState('Pharmaceutical waste bin');
  const [witness, setWitness] = useState('');
  const controlled = med.schedule === 'controlled';

  const submit = async () => {
    const ok = await run(
      (d, user) => action === 'adjust'
        ? adjust(d, { batchId: batch.id, delta, reason }, user)
        : changeBatchStatus(d, { batchId: batch.id, action, reason, method: action === 'dispose' ? method : undefined, witness: action === 'dispose' ? witness : undefined }, user),
      `${TITLES[action]}: lot ${batch.lotNumber} done.`,
    );
    if (ok) onClose();
  };

  return (
    <Modal open onClose={onClose} title={TITLES[action]}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={action === 'dispose' ? 'danger' : 'primary'} onClick={submit}>{TITLES[action]}</Button></>}>
      <div className="mb-4 rounded-md bg-surface-2 p-3">
        <div className="font-medium text-ink">{med.name} {med.strength}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2"><LotLabel lot={batch.lotNumber} expiry={batch.expiryDate} /><span className="num">{batch.qtyOnHand} units</span></div>
      </div>
      <div className="space-y-4">
        {action === 'adjust' && (
          <>
            <Input label="Change in units" type="number" mono value={delta || ''} onChange={(e) => setDelta(Number(e.target.value))}
              help={`Use a negative number to remove stock. New quantity: ${Math.max(0, batch.qtyOnHand + delta)}`} />
            <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose a reason</option>
              <option>Stock count correction</option><option>Damaged</option><option>Found during count</option><option>Theft or loss</option><option>Sample given</option>
            </Select>
          </>
        )}
        {action === 'return' && (
          <p className={`text-sm ${canReturnToSupplier(batch, supplier, today) ? 'text-ink-2' : 'text-critical'}`}>
            {supplier
              ? canReturnToSupplier(batch, supplier, today)
                ? `${supplier.name} accepts returns up to ${supplier.returnWindowDays} days before expiry. All ${batch.qtyOnHand} units will be returned.`
                : `${supplier.name} only accepts returns ${supplier.returnWindowDays}+ days before expiry. This batch is outside that window; check with them before sending.`
              : 'No supplier is recorded for this batch.'}
          </p>
        )}
        {action === 'dispose' && (
          <>
            <p className="text-sm text-ink-2">All {batch.qtyOnHand} units will be written off and recorded in the wastage report.</p>
            <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>Pharmaceutical waste bin</option><option>Incineration via contractor</option><option>Denaturing kit (controlled drugs)</option>
            </Select>
            <Input label={controlled ? 'Witness (required for controlled drugs)' : 'Witness (optional)'} value={witness} onChange={(e) => setWitness(e.target.value)} />
          </>
        )}
        {action !== 'adjust' && <Input label="Note" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />}
      </div>
    </Modal>
  );
}

/** Compact "…" menu of the actions this user may take on a batch. */
export function BatchMenu({ batch, onPick }: { batch: Batch; onPick: (a: ActionKind) => void }) {
  const { user, ds, today } = useData();
  const [open, setOpen] = useState(false);
  const supplier = ds.suppliers.find((s) => s.id === batch.supplierId);
  const items: [ActionKind, string, boolean][] = [
    ['adjust', 'Adjust quantity', can(user.role, 'adjust') && batch.status !== 'disposed' && batch.status !== 'returned'],
    ['quarantine', 'Quarantine', can(user.role, 'quarantine') && batch.status === 'active'],
    ['release', 'Release to stock', can(user.role, 'quarantine') && batch.status === 'quarantined'],
    ['return', canReturnToSupplier(batch, supplier, today) ? 'Return to supplier' : 'Return (outside window)', can(user.role, 'return') && ['active', 'quarantined'].includes(batch.status) && batch.qtyOnHand > 0],
    ['dispose', 'Dispose', can(user.role, 'dispose') && ['active', 'quarantined'].includes(batch.status) && batch.qtyOnHand > 0],
  ];
  const visible = items.filter(([, , ok]) => ok);
  if (!visible.length) return null;
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((o) => !o)} aria-label={`Actions for lot ${batch.lotNumber}`} aria-haspopup="menu" aria-expanded={open}
        className="rounded-sm p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink"><MoreHorizontal size={18} /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-9 z-40 w-52 rounded-md border border-line bg-surface p-1 text-left shadow-overlay">
            {visible.map(([a, label]) => (
              <button key={a} role="menuitem" onClick={() => { setOpen(false); onPick(a); }}
                className={`block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-surface-2 ${a === 'dispose' ? 'text-expired' : 'text-ink'}`}>{label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
