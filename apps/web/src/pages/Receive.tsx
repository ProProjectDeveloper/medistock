import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PackagePlus, Plus, Trash2 } from 'lucide-react';
import { addMonths, daysBetween, formatDate, receiveStock, type ReceiveLine } from '@medistock/core';
import { useData } from '../lib/store';
import { useMoney } from '../lib/format';
import { Button, Card, Input, LotLabel, Modal, PageHeader, Select } from '../components/ui';
import { MedicinePicker } from '../components/MedicinePicker';

type Line = ReceiveLine & { key: number };

export default function Receive() {
  const { ds, today, run } = useData();
  const money = useMoney();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const openPOs = ds.purchaseOrders.filter((p) => p.status === 'sent' || p.status === 'partial');
  const [poId, setPoId] = useState<string>(params.get('po') ?? '');
  const po = ds.purchaseOrders.find((p) => p.id === poId);
  const [supplierId, setSupplierId] = useState<string>(po?.supplierId ?? ds.suppliers[0]?.id ?? '');
  const [invoice, setInvoice] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [seq, setSeq] = useState(1);

  const newLine = (medicineId = '', k = seq, qty = 0, unitCost = 0): Line => {
    const med = ds.medicines.find((m) => m.id === medicineId);
    const last = ds.batches.filter((b) => b.medicineId === medicineId).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
    const cost = unitCost || last?.unitCost || 0;
    return {
      key: k, medicineId, supplierId: supplierId || null, lotNumber: '', expiryDate: addMonths(today, 18), qty, unitCost: cost,
      unitPrice: last?.unitPrice ?? Math.round(cost * 118) / 100, locationId: med?.locationId ?? null,
    };
  };
  const [lines, setLines] = useState<Line[]>(() => [newLine(params.get('med') ?? '', 0)]);

  const loadPO = (id: string) => {
    setPoId(id);
    const p = ds.purchaseOrders.find((x) => x.id === id);
    if (!p) return;
    setSupplierId(p.supplierId);
    const ls = p.lines.filter((l) => l.qtyOrdered > l.qtyReceived).map((l, i) => ({ ...newLine(l.medicineId, seq + i, l.qtyOrdered - l.qtyReceived, l.unitCost), supplierId: p.supplierId, poLineId: l.id }));
    setSeq((s) => s + ls.length);
    setLines(ls.length ? ls : [newLine('', seq)]);
  };

  const update = (k: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => {
    if (l.key !== k) return l;
    if (patch.medicineId && patch.medicineId !== l.medicineId) return { ...newLine(patch.medicineId, k), ...patch, lotNumber: l.lotNumber, qty: l.qty, poLineId: l.poLineId };
    return { ...l, ...patch };
  }));

  const valid = lines.filter((l) => l.medicineId && l.lotNumber.trim() && l.qty > 0);
  const total = valid.reduce((s, l) => s + l.qty * l.unitCost, 0);
  const problems = useMemo(() => lines.map((l) => {
    if (!l.medicineId) return null;
    const d = daysBetween(today, l.expiryDate);
    if (d < 0) return 'Already expired';
    if (d <= ds.settings.bandSoonDays) return `Short-dated: expires in ${d} days`;
    return null;
  }), [lines, today, ds.settings.bandSoonDays]);

  const submit = async () => {
    const ok = await run((d, user, t) => receiveStock(d, { invoiceRef: invoice || null, poId: poId || null, lines: valid.map(({ key: _k, ...l }) => ({ ...l, supplierId: supplierId || null })) }, user, t),
      `Received ${valid.length} line${valid.length === 1 ? '' : 's'} into stock.`);
    if (ok) {
      setConfirm(false);
      navigate(valid.length === 1 ? `/inventory/${valid[0].medicineId}` : '/inventory');
    }
  };

  return (
    <div className="animate-rise">
      <PageHeader title="Receive stock" subtitle="Scan or search each medicine, then enter the lot and expiry printed on the carton." />
      <Card>
        <div className="grid gap-4 md:grid-cols-3">
          <Select label="Against purchase order" value={poId} onChange={(e) => loadPO(e.target.value)} help="Optional. Pre-fills outstanding lines.">
            <option value="">No purchase order</option>
            {openPOs.map((p) => <option key={p.id} value={p.id}>{p.number} · {ds.suppliers.find((s) => s.id === p.supplierId)?.name}</option>)}
          </Select>
          <Select label="Supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            {ds.suppliers.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input label="Invoice reference" mono value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="INV-00000" />
        </div>
      </Card>

      <div className="mt-6 space-y-4">
        {lines.map((l, i) => (
          <Card key={l.key} className="relative">
            <div className="mb-4 flex items-center justify-between">
              <span className="label">Line {i + 1}</span>
              {lines.length > 1 && <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>Remove</Button>}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_0.8fr_0.8fr_0.8fr]">
              <MedicinePicker value={l.medicineId || null} onChange={(id) => update(l.key, { medicineId: id })} autoFocus={i === 0 && !l.medicineId} />
              <Input label="Lot number" mono value={l.lotNumber} onChange={(e) => update(l.key, { lotNumber: e.target.value.toUpperCase() })} placeholder="A2417K" />
              <Input label="Expiry date" type="date" mono value={l.expiryDate} onChange={(e) => update(l.key, { expiryDate: e.target.value })} error={problems[i]?.startsWith('Already') ? problems[i] : null}
                help={problems[i] && !problems[i]!.startsWith('Already') ? <span className="text-critical">{problems[i]}</span> : undefined} />
              <Input label="Quantity (units)" type="number" min={1} mono value={l.qty || ''} onChange={(e) => update(l.key, { qty: Number(e.target.value) })} />
              <Input label="Unit cost" type="number" min={0} step="0.01" mono value={l.unitCost || ''} onChange={(e) => update(l.key, { unitCost: Number(e.target.value) })} />
              <Input label="Unit price" type="number" min={0} step="0.01" mono value={l.unitPrice || ''} onChange={(e) => update(l.key, { unitPrice: Number(e.target.value) })} />
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-4">
        <Button icon={<Plus size={16} />} onClick={() => { setLines((ls) => [...ls, newLine('', seq)]); setSeq((s) => s + 1); }}>Add line</Button>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-line bg-surface px-4 py-3 shadow-raised md:-mx-6 md:px-6">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-ink-2"><span className="num font-medium text-ink">{valid.length}</span> ready to receive · <span className="num font-medium text-ink">{money(total)}</span> at cost</div>
          <Button variant="primary" icon={<PackagePlus size={16} />} disabled={!valid.length || problems.some((p) => p?.startsWith('Already'))} onClick={() => setConfirm(true)}>Review and receive</Button>
        </div>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Confirm receipt" size="lg"
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Back</Button><Button variant="primary" onClick={submit}>Receive {valid.length} line{valid.length === 1 ? '' : 's'}</Button></>}>
        <p className="mb-4 text-sm text-ink-2">{ds.suppliers.find((s) => s.id === supplierId)?.name}{invoice && <> · invoice <span className="num">{invoice}</span></>}{po && <> · {po.number}</>}</p>
        <ul className="divide-y divide-line rounded-md border border-line">
          {valid.map((l) => {
            const m = ds.medicines.find((x) => x.id === l.medicineId)!;
            return (
              <li key={l.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div><div className="font-medium text-ink">{m.name} {m.strength}</div><LotLabel lot={l.lotNumber} expiry={l.expiryDate} className="mt-1" /></div>
                <div className="text-right"><div className="num text-ink">+{l.qty}</div><div className="num text-xs text-ink-3">{money(l.qty * l.unitCost)} · exp {formatDate(l.expiryDate)}</div></div>
              </li>
            );
          })}
        </ul>
      </Modal>
    </div>
  );
}
