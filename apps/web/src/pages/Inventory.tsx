import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, PackageSearch, Plus, Search, Snowflake, ShieldAlert } from 'lucide-react';
import { can, formatDate, medicineSummaries, STORAGE_LABEL, type MedicineSummary } from '@medistock/core';
import { useData } from '../lib/store';
import { useMoney } from '../lib/format';
import { downloadCSV } from '../lib/csv';
import { BandPill, Button, Card, cx, EmptyState, ExpiryRibbon, Input, LotLabel, PageHeader, Select, StockBadge } from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { MedicineForm } from '../components/MedicineForm';

const VIEWS = [
  { key: 'all', label: 'All medicines' },
  { key: 'low', label: 'Low & out' },
  { key: 'expiring', label: 'Expiring ≤ 90d' },
  { key: 'cold', label: 'Cold chain' },
  { key: 'controlled', label: 'Controlled' },
] as const;
type View = (typeof VIEWS)[number]['key'];

export default function Inventory() {
  const { ds, today, user } = useData();
  const money = useMoney();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = (params.get('status') ?? 'all') as View;
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [adding, setAdding] = useState(false);
  const locs = new Map(ds.locations.map((l) => [l.id, l.name]));

  const all = useMemo(() => medicineSummaries(ds, today), [ds, today]);
  const categories = [...new Set(all.map((s) => s.medicine.category))].sort();
  const rows = all.filter((s) => {
    const m = s.medicine;
    const t = q.trim().toLowerCase();
    if (t && !(m.name.toLowerCase().includes(t) || m.genericName.toLowerCase().includes(t) || m.barcode.includes(t))) return false;
    if (category && m.category !== category) return false;
    if (view === 'low') return s.status !== 'in';
    if (view === 'expiring') return s.band === 'expired' || s.band === 'critical' || s.band === 'soon';
    if (view === 'cold') return m.storage === 'cold';
    if (view === 'controlled') return m.storage === 'controlled' || m.schedule === 'controlled';
    return true;
  });

  const columns: Column<MedicineSummary>[] = [
    {
      key: 'name', header: 'Medicine', sortValue: (r) => r.medicine.name,
      render: (r) => (
        <div className="min-w-[180px]">
          <div className="flex items-center gap-1.5 font-medium text-ink">
            {r.medicine.name}
            {r.medicine.storage === 'cold' && <Snowflake size={14} className="text-info" aria-label="Cold chain" />}
            {r.medicine.schedule === 'controlled' && <ShieldAlert size={14} className="text-critical" aria-label="Controlled drug" />}
          </div>
          <div className="text-sm text-ink-3">{r.medicine.genericName}</div>
        </div>
      ),
    },
    { key: 'form', header: 'Form · Strength', hideBelow: 'lg', render: (r) => <span className="text-sm text-ink-2">{r.medicine.form} · {r.medicine.strength}</span> },
    {
      key: 'onhand', header: 'On hand', align: 'right', mono: true, sortValue: (r) => r.onHand,
      render: (r) => <div><div className="text-ink">{r.onHand.toLocaleString()}</div><div className="text-xs text-ink-3">{r.packs} packs</div></div>,
    },
    {
      key: 'expiry', header: 'Nearest expiry', sortValue: (r) => r.nearestDays ?? 99999,
      render: (r) => r.nearest && r.band ? (
        <div className="flex items-center gap-3">
          <BandPill band={r.band} days={r.nearestDays} />
          <ExpiryRibbon expiry={r.nearest.expiryDate} today={today} settings={ds.settings} className="hidden md:block" />
        </div>
      ) : <span className="text-sm text-ink-3">No stock</span>,
    },
    { key: 'lot', header: 'Next lot', hideBelow: 'lg', render: (r) => r.nearest ? <LotLabel lot={r.nearest.lotNumber} expiry={r.nearest.expiryDate} /> : null },
    { key: 'status', header: 'Status', sortValue: (r) => ({ out: 0, low: 1, in: 2 })[r.status], render: (r) => <StockBadge status={r.status} /> },
    { key: 'value', header: 'Value', align: 'right', mono: true, hideBelow: 'lg', sortValue: (r) => r.costValue, render: (r) => money(r.costValue) },
    { key: 'loc', header: 'Location', hideBelow: 'md', render: (r) => <span className="text-sm text-ink-2">{r.medicine.locationId ? locs.get(r.medicine.locationId) : '—'}</span> },
  ];

  const exportCsv = () => downloadCSV(`medistock-inventory-${today}.csv`, [
    ['Medicine', 'Generic', 'Strength', 'Form', 'Category', 'Barcode', 'Storage', 'On hand (units)', 'Packs', 'Status', 'Nearest lot', 'Nearest expiry', 'Days left', 'Value at cost', 'Location'],
    ...rows.map((r) => [r.medicine.name, r.medicine.genericName, r.medicine.strength, r.medicine.form, r.medicine.category, r.medicine.barcode, STORAGE_LABEL[r.medicine.storage],
      r.onHand, r.packs, r.status, r.nearest?.lotNumber, r.nearest?.expiryDate, r.nearestDays, r.costValue.toFixed(2), r.medicine.locationId ? locs.get(r.medicine.locationId) : '']),
  ]);

  return (
    <div className="animate-rise">
      <PageHeader title="Inventory" subtitle={`${all.length} medicines · ${all.reduce((s, r) => s + r.batchCount, 0)} active batches`}
        actions={<>
          <Button icon={<Download size={16} />} onClick={exportCsv}>Export CSV</Button>
          {can(user.role, 'manageMedicines') && <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>Add medicine</Button>}
        </>} />

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Saved views">
        {VIEWS.map((v) => (
          <button key={v.key} onClick={() => setParams(v.key === 'all' ? {} : { status: v.key })} aria-pressed={view === v.key}
            className={cx('rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors', view === v.key ? 'border-brand bg-brand-tint text-brand' : 'border-line bg-surface text-ink-2 hover:border-ink-3 hover:text-ink')}>
            {v.label}
          </button>
        ))}
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <Input aria-label="Filter by name, generic or barcode" placeholder="Filter by name, generic or barcode" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select aria-label="Category" className="w-48" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </div>
        <DataTable caption="Medicines" rows={rows} columns={columns} rowKey={(r) => r.medicine.id} rowHref={(r) => `/inventory/${r.medicine.id}`}
          initialSort={{ key: 'expiry', dir: 'asc' }}
          empty={<EmptyState icon={<PackageSearch size={22} />} title="No medicines match" body="Try a different view or clear the filters." action={<Button onClick={() => { setQ(''); setCategory(''); setParams({}); }}>Clear filters</Button>} />} />
      </Card>
      <p className="mt-3 text-sm text-ink-3">Nearest expiry counts only active batches. Updated {formatDate(today)}.</p>
      {adding && <MedicineForm open onClose={() => setAdding(false)} onSaved={(id) => navigate(`/inventory/${id}`)} />}
    </div>
  );
}
