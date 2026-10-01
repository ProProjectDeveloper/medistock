import { useState, type FormEvent } from 'react';
import { Hourglass, Pill, ShieldCheck, Truck } from 'lucide-react';
import { DEMO_USERS, ROLE_LABEL } from '@medistock/core';
import { useStore } from '../lib/store';
import { Button, Input } from '../components/ui';

export default function SignIn() {
  const { signIn, mode } = useStore();
  const [email, setEmail] = useState(mode === 'demo' ? DEMO_USERS[0].email : '');
  const [password, setPassword] = useState(mode === 'demo' ? DEMO_USERS[0].password : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-brand-strong p-12 text-white lg:flex lg:flex-col" style={{ background: 'linear-gradient(160deg, #07524A 0%, #0B6E64 55%, #0E7D71 100%)' }}>
        <svg className="pointer-events-none absolute -right-24 -top-24 h-[520px] w-[520px] opacity-[0.09]" viewBox="0 0 200 200" aria-hidden>
          {Array.from({ length: 9 }).map((_, i) => <circle key={i} cx="100" cy="100" r={20 + i * 10} fill="none" stroke="white" strokeWidth="1" />)}
        </svg>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/15"><Pill size={20} /></span>
          <span className="font-display text-xl font-bold">MediStock</span>
        </div>
        <div className="mt-auto max-w-md">
          <h1 className="font-display text-3xl font-semibold leading-[1.1]">Every batch accounted for. Nothing expires on the shelf.</h1>
          <p className="mt-4 text-[17px] text-white/80">Stock, lots and expiry for your pharmacy in one calm place, with first-expiry-first-out built in.</p>
          <ul className="mt-8 space-y-3 text-white/90">
            <li className="flex items-center gap-3"><Hourglass size={18} /> Expiry alerts at 30 and 90 days</li>
            <li className="flex items-center gap-3"><Truck size={18} /> Reorder suggestions by supplier</li>
            <li className="flex items-center gap-3"><ShieldCheck size={18} /> Full audit trail of every movement</li>
          </ul>
        </div>
        <div className="mt-10 flex items-center gap-3 rounded-md bg-white/10 p-3 font-mono text-xs tracking-wide text-white/85 ring-1 ring-white/15 w-fit">
          <span>LOT A2417K</span><span className="text-white/40">·</span><span>EXP 11/2026</span>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand text-on-brand"><Pill size={20} /></span>
            <span className="font-display text-xl font-bold text-ink">MediStock</span>
          </div>
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-1 text-ink-2">Welcome back. Use your pharmacy account.</p>
          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required error={error} />
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          </form>
          {mode === 'demo' && (
            <div className="mt-8 rounded-md border border-line bg-surface p-4">
              <div className="label mb-2">Demo accounts</div>
              <p className="mb-3 text-sm text-ink-2">Password for all: <span className="num text-ink">demo1234</span>. Each role sees different actions.</p>
              <div className="flex flex-wrap gap-2">
                {DEMO_USERS.map((u) => (
                  <button key={u.id} type="button" onClick={() => { setEmail(u.email); setPassword(u.password); }}
                    className={`rounded-pill border px-3 py-1 text-sm ${email === u.email ? 'border-brand bg-brand-tint text-brand' : 'border-line text-ink-2 hover:border-ink-3'}`}>
                    {ROLE_LABEL[u.role]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
