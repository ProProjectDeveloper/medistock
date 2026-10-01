import { useState } from 'react';
import { Moon, Plus, RotateCcw, Sun, SunMoon } from 'lucide-react';
import { bandLabel, can, newId, ROLE_LABEL, updateSettings, type LocationKind } from '@medistock/core';
import { useData } from '../lib/store';
import { useTheme } from '../lib/theme';
import { BandPill, Button, Card, cx, Input, PageHeader, Select } from '../components/ui';

export default function Settings() {
  const { ds, user, run, mode, resetDemo } = useData();
  const admin = can(user.role, 'settings');
  const [s, setS] = useState(ds.settings);
  const [theme, setTheme] = useTheme();
  const [loc, setLoc] = useState<{ name: string; kind: LocationKind }>({ name: '', kind: 'shelf' });
  const dirty = JSON.stringify(s) !== JSON.stringify(ds.settings);

  return (
    <div className="animate-rise">
      <PageHeader title="Settings" subtitle={admin ? 'Pharmacy profile, expiry thresholds, people and places.' : 'Only admins can change pharmacy settings.'} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Pharmacy profile">
          <fieldset disabled={!admin} className="grid gap-4 sm:grid-cols-2">
            <Input label="Pharmacy name" className="sm:col-span-2" value={s.pharmacyName} onChange={(e) => setS({ ...s, pharmacyName: e.target.value })} />
            <Select label="Currency" value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })}>
              {['PKR', 'USD', 'GBP', 'EUR', 'AED', 'SAR', 'INR'].map((c) => <option key={c}>{c}</option>)}
            </Select>
            <Input label="Default reorder level (units)" type="number" min={0} mono value={s.defaultReorderLevel} onChange={(e) => setS({ ...s, defaultReorderLevel: Number(e.target.value) })} />
          </fieldset>
        </Card>

        <Card title="Expiry bands">
          <fieldset disabled={!admin} className="grid gap-4 sm:grid-cols-2">
            <Input label="Critical within (days)" type="number" min={1} mono value={s.bandCriticalDays} onChange={(e) => setS({ ...s, bandCriticalDays: Number(e.target.value) })} />
            <Input label="Soon within (days)" type="number" min={2} mono value={s.bandSoonDays} onChange={(e) => setS({ ...s, bandSoonDays: Number(e.target.value) })} />
          </fieldset>
          <div className="mt-4 flex flex-wrap gap-2">
            <BandPill band="expired" label={bandLabel('expired', s)} /><BandPill band="critical" label={bandLabel('critical', s)} />
            <BandPill band="soon" label={bandLabel('soon', s)} /><BandPill band="ok" label={bandLabel('ok', s)} />
          </div>
        </Card>
      </div>
      {admin && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={() => setS(ds.settings)}>Discard</Button>
          <Button variant="primary" disabled={!dirty} onClick={() => run((d) => updateSettings(d, s), 'Settings saved.')}>Save settings</Button>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Users and roles" padded={false}>
          <ul className="divide-y divide-line">
            {ds.profiles.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div><div className="font-medium text-ink">{p.fullName}{p.id === user.id && <span className="ml-2 text-sm font-normal text-ink-3">(you)</span>}</div><div className="text-sm text-ink-3">{p.email}</div></div>
                <span className={cx('rounded-pill px-2.5 py-0.5 text-sm font-medium', p.role === 'admin' ? 'bg-brand-tint text-brand' : 'bg-surface-2 text-ink-2')}>{ROLE_LABEL[p.role]}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3 text-sm text-ink-3">
            {mode === 'demo' ? 'Demo accounts are fixed. With Supabase, invite staff from the Supabase dashboard; the first sign-up becomes admin.' : 'Invite staff from Supabase Auth. New accounts start as Assistant; change roles in the profiles table.'}
          </p>
        </Card>

        <Card title="Locations" padded={false}>
          <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
            {ds.locations.map((l) => (
              <li key={l.id} className="bg-surface px-4 py-3"><div className="text-ink">{l.name}</div><div className="text-sm capitalize text-ink-3">{l.kind}</div></li>
            ))}
          </ul>
          {admin && (
            <form className="flex flex-wrap items-end gap-3 border-t border-line p-4" onSubmit={(e) => {
              e.preventDefault();
              if (!loc.name.trim()) return;
              run(() => ({ locations: [{ id: newId(), name: loc.name.trim(), kind: loc.kind }] }), 'Location added.').then((ok) => ok && setLoc({ name: '', kind: 'shelf' }));
            }}>
              <Input label="New location" className="min-w-40 flex-1" value={loc.name} onChange={(e) => setLoc({ ...loc, name: e.target.value })} placeholder="Shelf D1" />
              <Select label="Kind" className="w-32" value={loc.kind} onChange={(e) => setLoc({ ...loc, kind: e.target.value as LocationKind })}>
                <option value="shelf">Shelf</option><option value="fridge">Fridge</option><option value="safe">Safe</option>
              </Select>
              <Button type="submit" icon={<Plus size={16} />}>Add</Button>
            </form>
          )}
        </Card>

        <Card title="Appearance">
          <div className="grid grid-cols-3 gap-3">
            {([['light', <Sun size={20} />, 'Light'], ['dark', <Moon size={20} />, 'Dark'], ['system', <SunMoon size={20} />, 'Match device']] as const).map(([v, icon, l]) => (
              <button key={v} onClick={() => setTheme(v)} aria-pressed={theme === v}
                className={cx('flex flex-col items-center gap-2 rounded-md border py-4 text-sm font-medium', theme === v ? 'border-brand bg-brand-tint text-brand' : 'border-line text-ink-2 hover:border-ink-3')}>
                {icon}{l}
              </button>
            ))}
          </div>
        </Card>

        {mode === 'demo' && resetDemo && (
          <Card title="Demo data">
            <p className="text-sm text-ink-2">This browser is running on seeded demo data. Changes you make are saved here only. Reset to start fresh with the original 40 medicines and 90 batches.</p>
            <Button className="mt-4" icon={<RotateCcw size={16} />} onClick={resetDemo}>Reset demo data</Button>
          </Card>
        )}
      </div>
    </div>
  );
}
