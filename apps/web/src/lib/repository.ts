import { createClient } from '@supabase/supabase-js';
import { DemoRepository, type MediStockRepository } from '@medistock/core';
import { SupabaseRepository } from '@medistock/core/supabase';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function safeLocalStorage() {
  try {
    const k = '__ms_probe';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Supabase when configured, otherwise the seeded demo store in this browser. */
export const repository: MediStockRepository =
  url && key ? new SupabaseRepository(createClient(url, key)) : new DemoRepository(safeLocalStorage());
