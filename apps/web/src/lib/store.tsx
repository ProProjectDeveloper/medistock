import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { OperationError, todayISO, type ChangeSet, type Dataset, type Profile } from '@medistock/core';
import { repository } from './repository';
import { useToast } from '../components/Toast';

interface Store {
  ds: Dataset | null;
  user: Profile | null;
  today: string;
  loading: boolean;
  error: string | null;
  mode: 'demo' | 'supabase';
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Run an operation: build a change set from the current data, commit it, refresh. Returns true on success. */
  run(build: (ds: Dataset, user: Profile, today: string) => ChangeSet, success?: string): Promise<boolean>;
  reload(): Promise<void>;
  resetDemo?(): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [ds, setDs] = useState<Dataset | null>(null);
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const today = todayISO();

  const reload = useCallback(async () => {
    try {
      setDs(await repository.load());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const u = await repository.currentUser();
        setUser(u);
        if (u) await reload();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [reload]);

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await repository.signIn(email, password);
    setUser(u);
    await reload();
  }, [reload]);

  const signOut = useCallback(async () => {
    await repository.signOut();
    setUser(null);
    setDs(null);
  }, []);

  const run = useCallback<Store['run']>(async (build, success) => {
    if (!ds || !user) return false;
    try {
      const cs = build(ds, user, today);
      await repository.commit(cs);
      setDs(await repository.load());
      if (success) toast.show({ kind: 'success', message: success });
      return true;
    } catch (e) {
      toast.show({ kind: 'error', message: e instanceof OperationError ? e.message : `Could not save: ${(e as Error).message}` });
      return false;
    }
  }, [ds, user, today, toast]);

  const value = useMemo<Store>(() => ({
    ds, user, today, loading, error, mode: repository.mode, signIn, signOut, run, reload,
    resetDemo: repository.reset ? async () => { await repository.reset!(); await reload(); toast.show({ kind: 'info', message: 'Demo data restored.' }); } : undefined,
  }), [ds, user, today, loading, error, signIn, signOut, run, reload, toast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

/** For pages rendered inside the signed-in shell, where data and user are guaranteed. */
export function useData() {
  const s = useStore();
  return { ...s, ds: s.ds!, user: s.user! };
}
