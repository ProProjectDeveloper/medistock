import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRightLeft, BarChart3, Download, Hourglass, PackageMinus, Recycle, TrendingUp, Wallet } from 'lucide-react';
import {
  addDays, bandFor, bandLabel, daysLeft, expiryOutlook, formatDate, formatDateTime, MOVEMENT_LABEL, movementsBetween, movers, reorderSuggestions,
  valuationByCategory, wastage, type Band, type MovementType,
} from '@medistock/core';
import { useData } from '../lib/store';
import { useMoney } from '../lib/format';
import { downloadCSV } from '../lib/csv';
import { BandPill, Button, Card, EmptyState, Input, LotLabel, PageHeader, Segmented, Select } from '../components/ui';
import { HBars, Legend, StackedBars } from '../components/Charts';

const REPORTS = [
  { key: 'valuation', title: 'Stock valuation', body: 'Cost and retail value by category.', icon: <Wallet size={20} /> },
  { key: 'expiry', title: 'Expiry report', body: 'Value at risk by band and month.', icon: <Hourglass size={20} /> },
  { key: 'wastage', title: 'Wastage', body: 'Disposed and returned units and value.', icon: <Recycle size={20} /> },
  { key: 'movements', title: 'Stock movement log', body: 'The full, filterable audit trail.', icon: <ArrowRightLeft size={20} /> },
  { key: 'reorder', title: 'Low stock & reorder', body: 'What to order, grouped by supplier.', icon: <PackageMinus size={20} /> },
  { key: 'movers', title: 'Fast and slow movers', body: 'Dispensing volume over 30 or 90 days.', icon: <TrendingUp size={20} /> },
] as const;

export function ReportPicker() {
  return (
    <div className="animate-rise">
      <PageHeader title="Reports" subtitle="Every report has filters, a chart, a table and CSV export." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.key} to={`/reports/${r.key}`} className="group card flex flex-col p-5 transition-shadow hover:shadow-raised">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-tint text-brand">{r.icon}</span>
            <h2 className="mt-4 text-md font-semibold group-hover:text-brand">{r.title}</h2>
            <p className="mt-1 text-sm text-ink-2">{r.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Shell({ title, filters, onExport, children }: { title: string; filters?: ReactNode; onExport: () => void; children: ReactNode }) {
  return (
    <div className="animate-rise">
      <PageHeader back={<Link to="/reports" className="inline-flex items-center gap-1 text-ink-2 hover:text-ink"><ArrowLeft size={14} /> Reports</Link>}
        title={title} actions={<Button icon={<Download size={16} />} onClick={onExport}>Export CSV</Button>} />
      {filters && <div className="mb-6 flex flex-wrap items-end gap-3">{filters}</div>}
      {children}
    </div>
  );
}

function Table({ head, rows, right = [] }: { head: string[]; rows: ReactNode[][]; right?: number[] }) {
  if (!rows.length) return <EmptyState icon={<BarChart3 size={22} />} title="No data for this range" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead><tr className="border-b border-line">{head.map((h, i) => <th key={h} className={`label px-4 py-2.5 ${right.includes(i) ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line last:border-0">{r.map((c, j) => <td key={j} className={`h-11 px-4 py-2 ${right.includes(j) ? 'num text-right text-sm' : ''}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function ReportView() {
  const { kind } = useParams();
  const { ds, today } = useData();
  const money = useMoney();
  const [from, setFrom] = useState(addDays(today, -90));
  const [to, setTo] = useState(today);
  const [window, setWindow] = useState<'30' | '90'>('30');
  const [mvType, setMvType] = useState<'' | MovementType>('');
  const meds = new Map(ds.medicines.map((m) => [m.id, m]));
  const batches = new Map(ds.batches.map((b) => [b.id, b]));
  const people = new Map(ds.profiles.map((p) => [p.id, p.fullName]));
  const range = <>
    <Input label="From" type="date" mono value={from} onChange={(e) => setFrom(e.target.value)} />
    <Input label="To" type="date" mono value={to} onChange={(e) => setTo(e.target.value)} />
  </>;
  const csvName = (k: string) => `medistock-${k}-${today}.csv`;

  const valuation = useMemo(() => valuationByCategory(ds, today), [ds, today]);
  const outlook = useMemo(() => expiryOutlook(ds, today, 12), [ds, today]);

  switch (kind) {
    case 'valuation': {
      const total = valuation.reduce((s, r) => ({ cost: s.cost + r.cost, retail: s.retail + r.retail }), { cost: 0, retail: 0 });
      return (
        <Shell title="Stock valuation" onExport={() => downloadCSV(csvName('valuation'), [['Category', 'SKUs', 'Units', 'Cost value', 'Retail value'], ...valuation.map((r) => [r.category, r.skus, r.units, r.cost.toFixed(2), r.retail.toFixed(2)])])}>
          <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
            <Card title="Value at cost by category"><HBars rows={valuation.map((r) => ({ label: r.category, value: r.cost }))} format={(n) => money(n, true)} /></Card>
            <Card padded={false} title={<>Total {money(total.cost)} <span className="text-sm font-normal text-ink-3">at cost · {money(total.retail)} retail</span></>}>
              <Table head={['Category', 'SKUs', 'Units', 'Cost', 'Retail']} right={[1, 2, 3, 4]}
                rows={valuation.map((r) => [r.category, r.skus, r.units.toLocaleString(), money(r.cost), money(r.retail)])} />
            </Card>
          </div>
        </Shell>
      );
    }
    case 'expiry': {
      const rows = ds.batches.filter((b) => b.status === 'active' && b.qtyOnHand > 0).map((b) => ({ b, d: daysLeft(b, today) })).filter((r) => r.d <= ds.settings.bandSoonDays).sort((a, b) => a.d - b.d);
      return (
        <Shell title="Expiry report" onExport={() => downloadCSV(csvName('expiry'), [['Medicine', 'Lot', 'Expiry', 'Days left', 'Band', 'Qty', 'Value'], ...rows.map(({ b, d }) => [meds.get(b.medicineId)?.name, b.lotNumber, b.expiryDate, d, bandFor(d, ds.settings), b.qtyOnHand, (b.qtyOnHand * b.unitCost).toFixed(2)])])}>
          <Card title="Value at risk by month, next 12 months">
            <div className="mb-3"><Legend items={(['expired', 'critical', 'soon', 'ok'] as Band[]).map((b) => ({ band: b, label: bandLabel(b, ds.settings) }))} /></div>
            <StackedBars data={outlook} format={(n) => money(n, true)} label="Value at risk by month" height={240} />
          </Card>
          <Card className="mt-6" padded={false} title={`Batches expiring within ${ds.settings.bandSoonDays} days`}>
            <Table head={['Medicine', 'Lot', 'Expiry', 'Band', 'Qty', 'Value']} right={[4, 5]}
              rows={rows.map(({ b, d }) => [meds.get(b.medicineId)?.name, <LotLabel lot={b.lotNumber} />, formatDate(b.expiryDate), <BandPill band={bandFor(d, ds.settings)} days={d} />, b.qtyOnHand, money(b.qtyOnHand * b.unitCost)])} />
          </Card>
        </Shell>
      );
    }
    case 'wastage': {
      const rows = wastage(ds, from, to);
      const disposed = rows.filter((r) => r.movement.type === 'dispose');
      const returned = rows.filter((r) => r.movement.type === 'return');
      const sum = (xs: typeof rows) => xs.reduce((s, r) => s + r.value, 0);
      return (
        <Shell title="Wastage" filters={range} onExport={() => downloadCSV(csvName('wastage'), [['Date', 'Type', 'Medicine', 'Lot', 'Units', 'Value', 'Note'], ...rows.map((r) => [r.movement.createdAt, r.movement.type, r.medicine?.name, r.batch?.lotNumber, r.units, r.value.toFixed(2), r.movement.reason])])}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><div className="label">Disposed</div><div className="mt-2 font-display text-2xl font-semibold text-expired">{money(sum(disposed))}</div><div className="text-sm text-ink-2">{disposed.length} batches</div></Card>
            <Card><div className="label">Returned for credit</div><div className="mt-2 font-display text-2xl font-semibold text-ink">{money(sum(returned))}</div><div className="text-sm text-ink-2">{returned.length} batches</div></Card>
            <Card><div className="label">Total written off</div><div className="mt-2 font-display text-2xl font-semibold text-ink">{money(sum(rows))}</div><div className="text-sm text-ink-2">{rows.reduce((s, r) => s + r.units, 0)} units</div></Card>
          </div>
          <Card className="mt-6" padded={false}>
            <Table head={['Date', 'Type', 'Medicine', 'Lot', 'Units', 'Value', 'Note']} right={[4, 5]}
              rows={rows.map((r) => [formatDate(r.movement.createdAt.slice(0, 10)), MOVEMENT_LABEL[r.movement.type], r.medicine?.name, r.batch ? <LotLabel lot={r.batch.lotNumber} /> : '', r.units, money(r.value), <span className="text-sm text-ink-2">{r.movement.reason}</span>])} />
          </Card>
        </Shell>
      );
    }
    case 'movements': {
      const rows = movementsBetween(ds, from, to).filter((m) => !mvType || m.type === mvType).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return (
        <Shell title="Stock movement log" onExport={() => downloadCSV(csvName('movements'), [['Time', 'Type', 'Medicine', 'Lot', 'Qty', 'User', 'Reason', 'Reference'], ...rows.map((m) => { const b = batches.get(m.batchId); return [m.createdAt, m.type, b && meds.get(b.medicineId)?.name, b?.lotNumber, m.qty, m.userId && people.get(m.userId), m.reason, m.reference]; })])}
          filters={<>{range}<Select label="Type" value={mvType} onChange={(e) => setMvType(e.target.value as MovementType | '')}><option value="">All types</option>{Object.entries(MOVEMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></>}>
          <Card padded={false} title={<>{rows.length.toLocaleString()} movements <span className="text-sm font-normal text-ink-3">showing latest 300; export for all</span></>}>
            <Table head={['Time', 'Type', 'Medicine', 'Lot', 'Qty', 'By', 'Note']} right={[4]}
              rows={rows.slice(0, 300).map((m) => { const b = batches.get(m.batchId); return [<span className="num text-sm text-ink-2">{formatDateTime(m.createdAt)}</span>, MOVEMENT_LABEL[m.type], b && meds.get(b.medicineId)?.name, b ? <LotLabel lot={b.lotNumber} /> : '', m.qty > 0 ? `+${m.qty}` : m.qty, <span className="text-sm text-ink-2">{(m.userId && people.get(m.userId)) || '—'}</span>, <span className="text-sm text-ink-2">{m.reason ?? m.reference ?? ''}</span>]; })} />
          </Card>
        </Shell>
      );
    }
    case 'reorder': {
      const rows = reorderSuggestions(ds, today);
      return (
        <Shell title="Low stock & reorder" onExport={() => downloadCSV(csvName('reorder'), [['Medicine', 'Supplier', 'On hand', 'Reorder level', 'Suggested qty', 'Est. cost'], ...rows.map((r) => [r.medicine.name, r.supplier?.name, r.onHand, r.medicine.reorderLevel, r.suggestedQty, (r.suggestedQty * r.unitCost).toFixed(2)])])}>
          <Card padded={false} title={<>{rows.length} items to reorder · <span className="num">{money(rows.reduce((s, r) => s + r.suggestedQty * r.unitCost, 0))}</span></>} action={<Link className="link text-sm" to="/orders?suggest=1">Draft orders</Link>}>
            <Table head={['Medicine', 'Supplier', 'On hand', 'Reorder at', 'Suggest', 'Est. cost']} right={[2, 3, 4, 5]}
              rows={rows.sort((a, b) => (a.supplier?.name ?? '').localeCompare(b.supplier?.name ?? '')).map((r) => [<Link className="hover:underline" to={`/inventory/${r.medicine.id}`}>{r.medicine.name}</Link>, r.supplier?.name ?? '—', r.onHand, r.medicine.reorderLevel, `+${r.suggestedQty}`, money(r.suggestedQty * r.unitCost)])} />
          </Card>
        </Shell>
      );
    }
    case 'movers': {
      const rows = movers(ds, today, Number(window));
      return (
        <Shell title="Fast and slow movers" filters={<Segmented label="Period" value={window} onChange={setWindow} items={[{ value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]} />}
          onExport={() => downloadCSV(csvName('movers'), [['Medicine', 'Units dispensed', 'Per day', 'On hand', 'Days of cover'], ...rows.map((r) => [r.medicine.name, r.units, r.perDay.toFixed(2), r.onHand, r.perDay ? Math.round(r.onHand / r.perDay) : ''])])}>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Fastest movers"><HBars rows={rows.slice(0, 10).map((r) => ({ label: r.medicine.name, value: r.units }))} format={(n) => `${n} u`} /></Card>
            <Card title="Slowest movers"><HBars tone="info" rows={rows.slice(-10).reverse().map((r) => ({ label: r.medicine.name, value: r.units }))} format={(n) => `${n} u`} /></Card>
          </div>
          <Card className="mt-6" padded={false}>
            <Table head={['Medicine', 'Dispensed', 'Per day', 'On hand', 'Days of cover']} right={[1, 2, 3, 4]}
              rows={rows.map((r) => [r.medicine.name, r.units, r.perDay.toFixed(1), r.onHand, r.perDay ? Math.round(r.onHand / r.perDay) : '—'])} />
          </Card>
        </Shell>
      );
    }
    default:
      return <EmptyState icon={<BarChart3 size={22} />} title="Report not found" action={<Link to="/reports" className="link">All reports</Link>} />;
  }
}
