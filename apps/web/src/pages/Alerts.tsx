import { useMemo, useState } from 'react';
import { BellOff, Check, CheckCheck } from 'lucide-react';
import { can, computeAlerts, setAlertStatus, type Alert } from '@medistock/core';
import { useData } from '../lib/store';
import { useMoney } from '../lib/format';
import { BandPill, Button, ButtonLink, Card, EmptyState, LotLabel, PageHeader, Segmented, StockBadge } from '../components/ui';
import { ActionRow } from '../components/ActionRow';

export default function Alerts() {
  const { ds, today, user, run } = useData();
  const money = useMoney();
  const [status, setStatus] = useState<'open' | 'acknowledged' | 'all'>('open');
  const [kind, setKind] = useState<'all' | 'expiry' | 'stock'>('all');
  const all = useMemo(() => computeAlerts(ds, today), [ds, today]);
  const list = all.filter((a) => (status === 'all' || a.status === status) && (kind === 'all' || (kind === 'expiry' ? a.kind === 'expiry' : a.kind !== 'expiry')));
  const canAct = can(user.role, 'quarantine');

  const ack = (a: Alert, s: 'acknowledged' | 'resolved') => run((_d, u) => setAlertStatus(a.key, s, u), s === 'acknowledged' ? 'Alert acknowledged.' : 'Alert resolved.');
  const ackAll = () => run((_d, u) => ({ alertStates: list.filter((a) => a.status === 'open').flatMap((a) => setAlertStatus(a.key, 'acknowledged', u).alertStates!) }), 'All shown alerts acknowledged.');

  return (
    <div className="animate-rise">
      <PageHeader title="Alerts" subtitle="Expiry and stock-level alerts, worked out fresh from today's stock."
        actions={canAct && status === 'open' && list.length > 0 ? <Button icon={<CheckCheck size={16} />} onClick={ackAll}>Acknowledge all shown</Button> : undefined} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Segmented label="Status" value={status} onChange={setStatus} items={[{ value: 'open', label: `Open (${all.filter((a) => a.status === 'open').length})` }, { value: 'acknowledged', label: 'Acknowledged' }, { value: 'all', label: 'All' }]} />
        <Segmented label="Type" value={kind} onChange={setKind} items={[{ value: 'all', label: 'All types' }, { value: 'expiry', label: 'Expiry' }, { value: 'stock', label: 'Stock level' }]} />
      </div>
      <Card padded={false}>
        {list.length ? (
          <div className="space-y-2 p-4">
            {list.map((a) => (
              <ActionRow key={a.key} band={a.band} tone={a.kind !== 'expiry' ? 'info' : undefined} to={`/inventory/${a.medicine.id}`}
                title={a.title}
                meta={<>
                  {a.batch && <LotLabel lot={a.batch.lotNumber} expiry={a.batch.expiryDate} />}
                  {a.batch && <span className="num">{a.batch.qtyOnHand} units · {money(a.value)}</span>}
                  {a.status !== 'open' && <span className="text-ink-3">· {a.status}</span>}
                </>}
                action={<div className="flex items-center gap-2">
                  <span className="hidden sm:inline">{a.band ? <BandPill band={a.band} days={a.daysLeft} /> : <StockBadge status={a.kind === 'out_of_stock' ? 'out' : 'low'} />}</span>
                  {a.kind === 'expiry' ? <ButtonLink size="sm" to={`/expiry?band=${a.band}`}>Act</ButtonLink> : can(user.role, 'orders') ? <ButtonLink size="sm" to="/orders?suggest=1">Reorder</ButtonLink> : null}
                  {canAct && a.status === 'open' && <Button size="sm" variant="ghost" icon={<Check size={15} />} onClick={() => ack(a, 'acknowledged')} aria-label={`Acknowledge: ${a.title}`}>Ack</Button>}
                </div>}
              />
            ))}
          </div>
        ) : <EmptyState icon={<BellOff size={22} />} title="No alerts here" body={status === 'open' ? 'Everything is in date and above reorder level.' : 'Nothing matches this filter.'} />}
      </Card>
    </div>
  );
}
