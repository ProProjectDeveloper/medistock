import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Download, PackageX, Undo2 } from 'lucide-react';
import {
  bandFor, bandLabel, can, canReturnToSupplier, changeBatchStatus, daysLeft, formatDate, monthLabel, type Band, type Batch, type ChangeSet,
} from '@medistock/core';
import { useData } from '../lib/store';
import { useMoney } from '../lib/format';
import { downloadCSV } from '../lib/csv';
import { BandPill, bandClasses, Button, Card, cx, EmptyState, ExpiryRibbon, Input, LotLabel, Modal, PageHeader, Tabs } from '../components/ui';
import { BatchActionModal, BatchMenu, type ActionKind } from '../components/BatchActions';

interface Row { batch: Batch; days: number; band: Band; value: number }

export default function ExpiryCenter() {
  const { ds, today, user, run } = useData();
  const money = useMoney();
  const [params, setParams] = useSearchParams();
  const band = (params.get('band') as Band | null) ?? 'critical';
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<'return' | 'dispose' | null>(null);
  const [witness, setWitness] = useState('');
  const [action, setAction] = useState<{ batch: Batch; kind: ActionKind } | null>(null);
  const meds = new Map(ds.medicines.map((m) => [m.id, m]));
  const sups = new Map(ds.suppliers.map((s) => [s.id, s]));

  const rows = useMemo<Row[]>(() => ds.batches
    .filter((b) => (b.status === 'active' || b.status === 'quarantined') && b.qtyOnHand > 0)
    .map((b) => { const d = daysLeft(b, today); return { batch: b, days: d, band: bandFor(d, ds.settings), value: b.qtyOnHand * b.unitCost }; })
    .sort((a, b) => a.days - b.days), [ds, today]);

  const byBand = (k: Band) => rows.filter((r) => r.band === k);
  const view = byBand(band);
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of view) {
      const k = r.band === 'expired' ? 'expired' : r.batch.expiryDate.slice(0, 7);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()];
  }, [view]);

  const sel = view.filter((r) => selected.has(r.batch.id));
  const setBand = (b: Band) => { setParams({ band: b }); setSelected(new Set()); };
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const doBulk = async () => {
    const ok = await run((d, u) => {
      const merged: ChangeSet = { batches: [], movements: [] };
      for (const r of sel) {
        const cs = changeBatchStatus(d, { batchId: r.batch.id, action: bulk!, witness, reason: bulk === 'dispose' ? (r.days < 0 ? 'Expired' : 'Short-dated') : 'Returned to supplier' }, u);
        merged.batches!.push(...(cs.batches ?? []));
        merged.movements!.push(...(cs.movements ?? []));
      }
      return merged;
    }, `${bulk === 'return' ? 'Returned' : 'Disposed'} ${sel.length} batch${sel.length === 1 ? '' : 'es'}.`);
    if (ok) { setBulk(null); setSelected(new Set()); setWitness(''); }
  };

  const exportCsv = () => downloadCSV(`medistock-expiry-${band}-${today}.csv`, [
    ['Medicine', 'Strength', 'Lot', 'Expiry', 'Days left', 'Band', 'Qty', 'Unit cost', 'Value', 'Supplier', 'Status'],
    ...view.map((r) => { const m = meds.get(r.batch.medicineId)!; return [m.name, m.strength, r.batch.lotNumber, r.batch.expiryDate, r.days, r.band, r.batch.qtyOnHand, r.batch.unitCost, r.value.toFixed(2), sups.get(r.batch.supplierId ?? '')?.name, r.batch.status]; }),
  ]);

  const controlledInSel = sel.some((r) => meds.get(r.batch.medicineId)?.schedule === 'controlled');

  return (
    <div className="animate-rise">
      <PageHeader title="Expiry Center" subtitle="Act on short-dated stock before it becomes waste." actions={<Button icon={<Download size={16} />} onClick={exportCsv}>Export</Button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(['expired', 'critical', 'soon', 'ok'] as Band[]).map((b) => {
          const list = byBand(b);
          const active = b === band;
          return (
            <button key={b} onClick={() => setBand(b)} aria-pressed={active}
              className={cx('relative overflow-hidden rounded-md border p-4 text-left transition-all', active ? cx(bandClasses.bg[b], 'border-transparent') : 'border-line bg-surface hover:shadow-raised')}
              style={active ? { boxShadow: `0 0 0 2px var(--${b})` } : undefined}>
              <span className={cx('absolute inset-y-0 left-0 w-1', bandClasses.dot[b])} />
              <div className={cx('label', bandClasses.text[b])}>{bandLabel(b, ds.settings)}</div>
              <div className="mt-2 font-display text-2xl font-semibold text-ink">{list.length}</div>
              <div className="num text-sm text-ink-2">{money(list.reduce((s, r) => s + r.value, 0), true)}</div>
            </button>
          );
        })}
      </div>

      <Card className="mt-6" padded={false}>
        <div className="px-5 pt-2">
          <Tabs label="Expiry band" value={band} onChange={setBand}
            items={(['expired', 'critical', 'soon', 'ok'] as Band[]).map((b) => ({ value: b, label: bandLabel(b, ds.settings), count: byBand(b).length, tone: b }))} />
        </div>

        {sel.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-brand-tint px-5 py-3">
            <span className="text-sm font-medium text-brand">{sel.length} selected · {money(sel.reduce((s, r) => s + r.value, 0))}</span>
            <div className="flex gap-2">
              {can(user.role, 'return') && <Button size="sm" icon={<Undo2 size={15} />} onClick={() => setBulk('return')}>Return to supplier</Button>}
              {can(user.role, 'dispose') && <Button size="sm" variant="danger" icon={<PackageX size={15} />} onClick={() => setBulk('dispose')}>Dispose</Button>}
            </div>
          </div>
        )}

        {groups.length ? groups.map(([k, list]) => (
          <section key={k}>
            <h3 className="flex items-center justify-between border-b border-line bg-surface-2 px-5 py-2 font-body text-sm font-semibold text-ink-2">
              <span>{k === 'expired' ? 'Already expired' : monthLabel(k).replace(/ (\d\d)$/, ' 20$1')}</span>
              <span className="num font-normal">{list.length} · {money(list.reduce((s, r) => s + r.value, 0))}</span>
            </h3>
            <ul className="divide-y divide-line">
              {list.map((r) => {
                const m = meds.get(r.batch.medicineId)!;
                const s = sups.get(r.batch.supplierId ?? '');
                const returnable = canReturnToSupplier(r.batch, s, today);
                return (
                  <li key={r.batch.id} className={cx('grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3 md:grid-cols-[auto_1.6fr_1fr_auto_auto]', selected.has(r.batch.id) && 'bg-brand-tint')}>
                    <input type="checkbox" aria-label={`Select ${m.name} lot ${r.batch.lotNumber}`} checked={selected.has(r.batch.id)} onChange={() => toggle(r.batch.id)} className="h-4 w-4 accent-[var(--brand)]" />
                    <div className="min-w-0">
                      <Link to={`/inventory/${m.id}`} className="font-medium text-ink hover:underline">{m.name} <span className="font-normal text-ink-2">{m.strength}</span></Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
                        <LotLabel lot={r.batch.lotNumber} expiry={r.batch.expiryDate} />
                        <span className="num">{r.batch.qtyOnHand} units · {money(r.value)}</span>
                        {r.batch.status === 'quarantined' && <span className="font-medium text-critical">Quarantined</span>}
                      </div>
                    </div>
                    <div className="hidden text-sm md:block">
                      <div className="text-ink-2">{s?.name ?? 'No supplier'}</div>
                      <div className={returnable ? 'text-ok' : 'text-ink-3'}>{s ? (returnable ? `Returnable (${s.returnWindowDays}d window)` : `Past ${s.returnWindowDays}d return window`) : ''}</div>
                    </div>
                    <div className="hidden items-center gap-3 md:flex">
                      <ExpiryRibbon expiry={r.batch.expiryDate} today={today} settings={ds.settings} />
                      <BandPill band={r.band} days={r.days} />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="md:hidden"><BandPill band={r.band} days={r.days} /></span>
                      <BatchMenu batch={r.batch} onPick={(kind) => setAction({ batch: r.batch, kind })} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )) : <EmptyState icon={<CheckCircle2 size={22} />} title={`No batches ${band === 'expired' ? 'expired' : 'in this band'}`} body="Nice. Nothing here needs action." />}
      </Card>
      <p className="mt-3 text-sm text-ink-3">Bands: expired, ≤ {ds.settings.bandCriticalDays} days, ≤ {ds.settings.bandSoonDays} days, later. Change them in Settings. Today is {formatDate(today)}.</p>

      <Modal open={!!bulk} onClose={() => setBulk(null)} title={bulk === 'return' ? `Return ${sel.length} batches` : `Dispose of ${sel.length} batches`}
        footer={<><Button variant="ghost" onClick={() => setBulk(null)}>Cancel</Button>
          <Button variant={bulk === 'dispose' ? 'danger' : 'primary'} onClick={doBulk} disabled={bulk === 'dispose' && controlledInSel && !witness.trim()}>{bulk === 'return' ? 'Return all' : 'Dispose all'}</Button></>}>
        <p className="text-sm text-ink-2">
          {bulk === 'return'
            ? `${sel.filter((r) => !canReturnToSupplier(r.batch, sups.get(r.batch.supplierId ?? ''), today)).length} of these are outside their supplier's return window.`
            : 'All units in these batches will be written off and logged in the wastage report.'}
        </p>
        <ul className="mt-3 max-h-56 space-y-1.5 overflow-auto text-sm">
          {sel.map((r) => <li key={r.batch.id} className="flex justify-between gap-2"><span>{meds.get(r.batch.medicineId)?.name}</span><LotLabel lot={r.batch.lotNumber} /></li>)}
        </ul>
        {bulk === 'dispose' && <Input className="mt-4" label={controlledInSel ? 'Witness (required: includes controlled drugs)' : 'Witness (optional)'} value={witness} onChange={(e) => setWitness(e.target.value)} />}
      </Modal>
      {action && <BatchActionModal batch={action.batch} action={action.kind} onClose={() => setAction(null)} />}
    </div>
  );
}
