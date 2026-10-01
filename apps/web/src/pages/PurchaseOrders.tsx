import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, PackagePlus, Plus, Send, Sparkles, Trash2, X } from 'lucide-react';
import {
  addDays, can, formatDate, nextPoNumber, PO_STATUS_LABEL, poTotal, reorderSuggestions, savePurchaseOrder, setPurchaseOrderStatus,
  type POLine, type POStatus, type PurchaseOrder, type ReorderSuggestion,
} from '@medistock/core';
import { useData } from '../lib/store';
import { useMoney } from '../lib/format';
import { Button, ButtonLink, Card, cx, EmptyState, Input, PageHeader, Segmented, Select } from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { MedicinePicker } from '../components/MedicinePicker';

export function PoStatus({ status }: { status: POStatus }) {
  const cls: Record<POStatus, string> = {
    draft: 'bg-surface-2 text-ink-2', sent: 'bg-info-tint text-info', partial: 'bg-soon-tint text-soon', received: 'bg-ok-tint text-ok', cancelled: 'bg-surface-2 text-ink-3 line-through',
  };
  return <span className={cx('inline-flex rounded-pill px-2.5 py-0.5 text-sm font-medium', cls[status])}>{PO_STATUS_LABEL[status]}</span>;
}

export function PurchaseOrderList() {
  const { ds, today, run } = useData();
  const money = useMoney();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const showSuggest = params.get('suggest') === '1';
  const suggestions = useMemo(() => reorderSuggestions(ds, today), [ds, today]);
  const bySupplier = useMemo(() => {
    const m = new Map<string, ReorderSuggestion[]>();
    for (const s of suggestions) { const k = s.supplier?.id ?? ''; m.set(k, [...(m.get(k) ?? []), s]); }
    return [...m.entries()];
  }, [suggestions]);
  const sups = new Map(ds.suppliers.map((s) => [s.id, s]));
  const rows = ds.purchaseOrders.filter((p) => filter === 'all' || ['draft', 'sent', 'partial'].includes(p.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const draftFrom = async (supplierId: string, items: ReorderSuggestion[]) => {
    let newId = '';
    const ok = await run((d, u) => {
      const cs = savePurchaseOrder(d, {
        supplierId, status: 'draft', orderedAt: null, expectedAt: addDays(today, sups.get(supplierId)?.leadTimeDays ?? 3), createdBy: u.id,
        lines: items.map((s) => ({ id: '', poId: '', medicineId: s.medicine.id, qtyOrdered: s.suggestedQty, qtyReceived: 0, unitCost: s.unitCost })),
      });
      newId = cs.purchaseOrders![0].id;
      return cs;
    }, 'Draft order created from suggestions.');
    if (ok) navigate(`/orders/${newId}`);
  };

  const cols: Column<PurchaseOrder>[] = [
    { key: 'n', header: 'Order', sortValue: (p) => p.number, render: (p) => <span className="num font-medium text-ink">{p.number}</span> },
    { key: 's', header: 'Supplier', sortValue: (p) => sups.get(p.supplierId)?.name ?? '', render: (p) => sups.get(p.supplierId)?.name },
    { key: 'st', header: 'Status', render: (p) => <PoStatus status={p.status} /> },
    { key: 'o', header: 'Ordered', hideBelow: 'md', render: (p) => <span className="text-sm text-ink-2">{p.orderedAt ? formatDate(p.orderedAt.slice(0, 10)) : '—'}</span> },
    { key: 'e', header: 'Expected', hideBelow: 'md', render: (p) => <span className="text-sm text-ink-2">{formatDate(p.expectedAt)}</span> },
    { key: 'l', header: 'Lines', align: 'right', mono: true, render: (p) => p.lines.length },
    { key: 't', header: 'Total', align: 'right', mono: true, sortValue: poTotal, render: (p) => money(poTotal(p)) },
  ];

  return (
    <div className="animate-rise">
      <PageHeader title="Purchase orders" subtitle="Draft, send and receive orders from your suppliers."
        actions={<>
          <Button icon={<Sparkles size={16} />} onClick={() => setParams(showSuggest ? {} : { suggest: '1' })}>{showSuggest ? 'Hide suggestions' : `Reorder suggestions (${suggestions.length})`}</Button>
          <ButtonLink variant="primary" to="/orders/new" icon={<Plus size={16} />}>New order</ButtonLink>
        </>} />

      {showSuggest && (
        <Card className="mb-6" title="Reorder suggestions" action={<button onClick={() => setParams({})} aria-label="Close suggestions" className="rounded-sm p-1 text-ink-3 hover:bg-surface-2"><X size={16} /></button>}>
          <p className="mb-4 text-sm text-ink-2">Items at or below their reorder level, topped up to three times that level in whole packs, minus anything already on order.</p>
          {bySupplier.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {bySupplier.map(([sid, items]) => (
                <div key={sid} className="rounded-md border border-line">
                  <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                    <span className="font-medium text-ink">{sups.get(sid)?.name ?? 'No supplier on record'}</span>
                    {sid && <Button size="sm" variant="primary" onClick={() => draftFrom(sid, items)}>Create draft</Button>}
                  </div>
                  <ul className="divide-y divide-line text-sm">
                    {items.map((s) => (
                      <li key={s.medicine.id} className="flex justify-between gap-2 px-4 py-2">
                        <span className="text-ink">{s.medicine.name} <span className="text-ink-3">{s.medicine.strength}</span></span>
                        <span className="num text-ink-2">{s.onHand} → <span className="text-ink">+{s.suggestedQty}</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : <EmptyState icon={<Sparkles size={22} />} title="Nothing to reorder" body="All medicines are above their reorder level or already on order." />}
        </Card>
      )}

      <div className="mb-4"><Segmented label="Show" value={filter} onChange={setFilter} items={[{ value: 'open', label: 'Open' }, { value: 'all', label: 'All orders' }]} /></div>
      <Card padded={false}>
        <DataTable caption="Purchase orders" rows={rows} columns={cols} rowKey={(p) => p.id} rowHref={(p) => `/orders/${p.id}`}
          empty={<EmptyState icon={<ClipboardList size={22} />} title="No open orders" action={<ButtonLink to="/orders/new" variant="primary">New order</ButtonLink>} />} />
      </Card>
    </div>
  );
}

export function PurchaseOrderEditor() {
  const { id } = useParams();
  const { ds, today, user, run } = useData();
  const money = useMoney();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const existing = ds.purchaseOrders.find((p) => p.id === id);
  const editable = !existing || existing.status === 'draft';
  const [supplierId, setSupplierId] = useState(existing?.supplierId ?? params.get('supplier') ?? ds.suppliers[0]?.id ?? '');
  const [expectedAt, setExpectedAt] = useState(existing?.expectedAt ?? addDays(today, 3));
  const [lines, setLines] = useState<POLine[]>(existing?.lines ?? []);
  const [pick, setPick] = useState<string | null>(null);
  const total = lines.reduce((s, l) => s + l.qtyOrdered * l.unitCost, 0);

  if (id && id !== 'new' && !existing) return <EmptyState icon={<ClipboardList size={22} />} title="Order not found" action={<ButtonLink to="/orders">Back to orders</ButtonLink>} />;

  const addLine = (medicineId: string) => {
    const last = ds.batches.filter((b) => b.medicineId === medicineId).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
    const med = ds.medicines.find((m) => m.id === medicineId)!;
    setLines((ls) => ls.some((l) => l.medicineId === medicineId) ? ls : [...ls, { id: '', poId: '', medicineId, qtyOrdered: med.packSize * 10, qtyReceived: 0, unitCost: last?.unitCost ?? 0 }]);
    setPick(null);
  };

  const save = async (status: POStatus) => {
    let savedId = existing?.id ?? '';
    const ok = await run((d, u) => {
      const cs = savePurchaseOrder(d, {
        id: existing?.id, number: existing?.number, createdAt: existing?.createdAt, supplierId, expectedAt, createdBy: existing?.createdBy ?? u.id,
        status, orderedAt: status === 'sent' ? new Date().toISOString() : existing?.orderedAt ?? null, lines,
      });
      savedId = cs.purchaseOrders![0].id;
      return cs;
    }, status === 'sent' ? 'Order marked as sent.' : 'Draft saved.');
    if (ok) navigate(`/orders/${savedId}`, { replace: true });
  };
  const setStatus = (s: POStatus) => run((d) => setPurchaseOrderStatus(d, existing!.id, s), `Order ${PO_STATUS_LABEL[s].toLowerCase()}.`);

  return (
    <div className="animate-rise">
      <PageHeader back={<Link to="/orders" className="inline-flex items-center gap-1 text-ink-2 hover:text-ink"><ArrowLeft size={14} /> Purchase orders</Link>}
        title={<span className="flex items-center gap-3">{existing?.number ?? nextPoNumber(ds)} {existing && <PoStatus status={existing.status} />}</span>}
        subtitle={existing?.orderedAt ? `Sent ${formatDate(existing.orderedAt.slice(0, 10))}` : 'Draft order'}
        actions={can(user.role, 'orders') ? <>
          {editable && <Button onClick={() => save('draft')} disabled={!lines.length}>Save draft</Button>}
          {editable && <Button variant="primary" icon={<Send size={16} />} onClick={() => save('sent')} disabled={!lines.length}>Mark as sent</Button>}
          {existing && ['sent', 'partial'].includes(existing.status) && <ButtonLink variant="primary" to={`/receive?po=${existing.id}`} icon={<PackagePlus size={16} />}>Receive against order</ButtonLink>}
          {existing && ['draft', 'sent'].includes(existing.status) && <Button variant="ghost" onClick={() => setStatus('cancelled')}>Cancel order</Button>}
        </> : undefined} />

      <Card>
        <div className="grid gap-4 md:grid-cols-3">
          <Select label="Supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} disabled={!editable}>
            {ds.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input label="Expected delivery" type="date" mono value={expectedAt ?? ''} onChange={(e) => setExpectedAt(e.target.value)} disabled={!editable} />
          <div className="flex flex-col justify-end">
            <div className="label">Order total</div>
            <div className="num mt-1 text-xl text-ink">{money(total)}</div>
          </div>
        </div>
      </Card>

      <Card className="mt-6" padded={false} title="Lines">
        {lines.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="border-b border-line">
                <th className="label px-5 py-2.5">Medicine</th><th className="label px-4 py-2.5 text-right">Qty</th><th className="label px-4 py-2.5 text-right">Unit cost</th>
                {!editable && <th className="label px-4 py-2.5 text-right">Received</th>}<th className="label px-4 py-2.5 text-right">Line total</th>{editable && <th />}
              </tr></thead>
              <tbody>
                {lines.map((l, i) => {
                  const m = ds.medicines.find((x) => x.id === l.medicineId)!;
                  const upd = (patch: Partial<POLine>) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  return (
                    <tr key={l.medicineId} className="border-b border-line last:border-0">
                      <td className="px-5 py-2"><div className="font-medium text-ink">{m.name} <span className="font-normal text-ink-2">{m.strength}</span></div><div className="text-sm text-ink-3">pack of {m.packSize}</div></td>
                      <td className="px-4 py-2 text-right">{editable ? <Input aria-label={`Quantity for ${m.name}`} type="number" min={1} mono className="ml-auto w-24 text-right" value={l.qtyOrdered} onChange={(e) => upd({ qtyOrdered: Number(e.target.value) })} /> : <span className="num">{l.qtyOrdered}</span>}</td>
                      <td className="px-4 py-2 text-right">{editable ? <Input aria-label={`Unit cost for ${m.name}`} type="number" min={0} step="0.01" mono className="ml-auto w-28 text-right" value={l.unitCost} onChange={(e) => upd({ unitCost: Number(e.target.value) })} /> : <span className="num">{money(l.unitCost)}</span>}</td>
                      {!editable && <td className="num px-4 py-2 text-right">{l.qtyReceived} / {l.qtyOrdered}</td>}
                      <td className="num px-4 py-2 text-right text-ink">{money(l.qtyOrdered * l.unitCost)}</td>
                      {editable && <td className="px-3 py-2 text-right"><button className="rounded-sm p-1.5 text-ink-3 hover:bg-surface-2 hover:text-expired" aria-label={`Remove ${m.name}`} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 size={16} /></button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={<ClipboardList size={22} />} title="No lines yet" body="Add the medicines you want to order." />}
        {editable && (
          <div className="border-t border-line p-5">
            <div className="max-w-md"><MedicinePicker label="Add medicine" value={pick} onChange={addLine} /></div>
          </div>
        )}
      </Card>
    </div>
  );
}
