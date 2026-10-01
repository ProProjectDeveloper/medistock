import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, ArrowRight, CheckCircle2, Hourglass, PackageMinus, Wallet } from 'lucide-react';
import {
  bandFor, bandLabel, computeAlerts, daysLeft, expiryOutlook, formatDate, formatDateTime, kpis, MOVEMENT_LABEL, reorderSuggestions,
} from '@medistock/core';
import { useData } from '../lib/store';
import { useMoney } from '../lib/format';
import { BandPill, bandClasses, ButtonLink, Card, EmptyState, KpiTile, LotLabel, PageHeader, StockBadge } from '../components/ui';
import { Legend, StackedBars } from '../components/Charts';
import { ActionRow } from '../components/ActionRow';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { ds, today, user } = useData();
  const money = useMoney();
  const k = useMemo(() => kpis(ds, today), [ds, today]);
  const outlook = useMemo(() => expiryOutlook(ds, today, 6), [ds, today]);
  const alerts = useMemo(() => computeAlerts(ds, today).filter((a) => a.status === 'open'), [ds, today]);
  const needs = alerts.filter((a) => a.band === 'expired' || a.band === 'critical' || a.kind === 'out_of_stock').slice(0, 5);
  const reorder = useMemo(() => reorderSuggestions(ds, today).slice(0, 5), [ds, today]);
  const batches = new Map(ds.batches.map((b) => [b.id, b]));
  const meds = new Map(ds.medicines.map((m) => [m.id, m]));
  const people = new Map(ds.profiles.map((p) => [p.id, p]));
  const recent = [...ds.movements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 7);
  const atRisk6 = outlook.slice(1).reduce((s, b) => s + b.values.critical + b.values.soon, 0);

  return (
    <div className="animate-rise">
      <PageHeader
        title={`${greeting()}, ${user.fullName.split(' ')[0]}`}
        subtitle={<>{formatDate(today)} · {ds.settings.pharmacyName}</>}
        actions={<>
          <ButtonLink to="/dispense">Dispense</ButtonLink>
          <ButtonLink to="/receive" variant="primary">Receive stock</ButtonLink>
        </>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Stock value" value={money(k.stockValue, true)} sub={<>At cost · {money(k.retailValue, true)} retail</>} icon={<Wallet size={18} />} to="/reports/valuation" />
        <KpiTile label="Items low" value={k.lowCount + k.outCount} sub={<>{k.outCount} out of stock</>} tone={k.lowCount + k.outCount ? 'info' : undefined} icon={<PackageMinus size={18} />} to="/inventory?status=low" />
        <KpiTile label="Expiring ≤ 30d" value={k.expiring30Count} sub={<>{money(k.expiring30Value, true)} at risk</>} tone={k.expiring30Count ? 'critical' : undefined} icon={<Hourglass size={18} />} to="/expiry?band=critical" />
        <KpiTile label="Expired on shelf" value={k.expiredCount} sub={<>{money(k.expiredValue, true)} to return or dispose</>} tone={k.expiredCount ? 'expired' : undefined} icon={<AlertOctagon size={18} />} to="/expiry?band=expired" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Card title="Expiry outlook" action={<Link to="/expiry" className="link text-sm">Expiry Center</Link>}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-display text-xl font-semibold">{money(atRisk6, true)}</div>
              <div className="text-sm text-ink-2">stock value expiring in the next 6 months</div>
            </div>
            <Legend items={(['expired', 'critical', 'soon', 'ok'] as const).map((b) => ({ band: b, label: bandLabel(b, ds.settings) }))} />
          </div>
          <StackedBars data={outlook} format={(n) => money(n, true)} label="Stock value by expiry month, stacked by band" height={270} />
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
            {(['expired', 'critical', 'soon', 'ok'] as const).map((b) => {
              const n = ds.batches.filter((x) => x.status === 'active' && x.qtyOnHand > 0 && bandFor(daysLeft(x, today), ds.settings) === b);
              return (
                <Link key={b} to={`/expiry?band=${b}`} className="bg-surface px-4 py-3 hover:bg-surface-2">
                  <dt className="flex items-center gap-1.5 text-sm text-ink-2"><span className={`h-2 w-2 rounded-full ${bandClasses.dot[b]}`} />{bandLabel(b, ds.settings)}</dt>
                  <dd className="mt-1 flex items-baseline gap-2"><span className="font-display text-lg font-semibold text-ink">{n.length}</span><span className="num text-xs text-ink-3">{money(n.reduce((s, x) => s + x.qtyOnHand * x.unitCost, 0), true)}</span></dd>
                </Link>
              );
            })}
          </dl>
        </Card>

        <Card title="Needs action" action={<Link to="/alerts" className="link text-sm">All alerts ({alerts.length})</Link>}>
          {needs.length ? (
            <div className="space-y-2">
              {needs.map((a) => (
                <ActionRow key={a.key} band={a.band} tone={a.kind !== 'expiry' ? 'info' : undefined}
                  to={`/inventory/${a.medicine.id}`}
                  title={<>{a.medicine.name} <span className="font-normal text-ink-2">{a.medicine.strength}</span></>}
                  meta={a.batch ? <><LotLabel lot={a.batch.lotNumber} /><span className="num">{a.batch.qtyOnHand} u · {money(a.value)}</span></> : <span>Reorder level {a.medicine.reorderLevel}</span>}
                  action={a.band ? <BandPill band={a.band} days={a.daysLeft} /> : <StockBadge status="out" />}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={<CheckCircle2 size={22} />} title="Nothing urgent" body="No expired or critical batches and nothing out of stock." />
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Reorder suggestions" padded={false} action={<Link to="/orders" className="link text-sm">Purchase orders</Link>}>
          {reorder.length ? (
            <ul className="divide-y divide-line">
              {reorder.map((r) => (
                <li key={r.medicine.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/inventory/${r.medicine.id}`} className="font-medium text-ink hover:underline">{r.medicine.name} <span className="font-normal text-ink-2">{r.medicine.strength}</span></Link>
                    <div className="text-sm text-ink-2">{r.supplier?.name ?? 'No supplier yet'}</div>
                  </div>
                  <div className="text-right">
                    <div className="num text-sm text-ink">+{r.suggestedQty}</div>
                    <div className="num text-xs text-ink-3">{r.onHand} on hand</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={<CheckCircle2 size={22} />} title="Stock levels look healthy" />}
          <div className="border-t border-line px-5 py-3">
            <Link to="/orders?suggest=1" className="link inline-flex items-center gap-1 text-sm font-medium">Draft orders from suggestions <ArrowRight size={14} /></Link>
          </div>
        </Card>

        <Card title="Recent movements" padded={false} action={<Link to="/reports/movements" className="link text-sm">Movement log</Link>}>
          <ul className="divide-y divide-line">
            {recent.map((mv) => {
              const b = batches.get(mv.batchId);
              const m = b && meds.get(b.medicineId);
              return (
                <li key={mv.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`num w-14 shrink-0 text-right text-sm font-medium ${mv.qty > 0 ? 'text-ok' : mv.qty < 0 ? 'text-ink' : 'text-ink-3'}`}>{mv.qty > 0 ? `+${mv.qty}` : mv.qty}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-ink">{MOVEMENT_LABEL[mv.type]} · {m?.name ?? 'Unknown'}</div>
                    <div className="truncate text-sm text-ink-3">{formatDateTime(mv.createdAt)}{mv.userId && people.get(mv.userId) ? ` · ${people.get(mv.userId)!.fullName}` : ''}</div>
                  </div>
                  {b && <LotLabel lot={b.lotNumber} className="hidden sm:inline-flex" />}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
