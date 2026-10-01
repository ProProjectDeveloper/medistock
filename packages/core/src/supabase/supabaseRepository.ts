import type { SupabaseClient } from '@supabase/supabase-js';
import type { MediStockRepository } from '../repository.ts';
import type { ChangeSet, Dataset, Profile } from '../types.ts';
import { fromRow, toRow } from './mapping.ts';

type Row = Record<string, unknown>;

/** Supabase backend. Pass a client created with the project URL and anon key; row-level security does the rest. */
export class SupabaseRepository implements MediStockRepository {
  readonly mode = 'supabase' as const;
  private sb: SupabaseClient;
  constructor(client: SupabaseClient) {
    this.sb = client;
  }

  private async profileFor(userId: string): Promise<Profile> {
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', userId).single();
    if (error) throw new Error(error.message);
    return fromRow.profile(data as Row);
  }

  async currentUser(): Promise<Profile | null> {
    const { data } = await this.sb.auth.getSession();
    const uid = data.session?.user.id;
    return uid ? this.profileFor(uid) : null;
  }

  async signIn(email: string, password: string): Promise<Profile> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return this.profileFor(data.user.id);
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut();
  }

  /** Reads every row of a table, 1000 at a time (PostgREST's default page cap). */
  private async all(table: string, order = 'id'): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.sb.from(table).select('*').order(order).range(from, from + 999);
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...((data ?? []) as Row[]));
      if (!data || data.length < 1000) return out;
    }
  }

  async load(): Promise<Dataset> {
    const [settings, locations, medicines, batches, movements, suppliers, pos, lines, alerts, profiles] = await Promise.all([
      this.sb.from('settings').select('*').eq('id', 1).single(),
      this.all('locations'), this.all('medicines'), this.all('batches'), this.all('stock_movements', 'created_at'),
      this.all('suppliers'), this.all('purchase_orders'), this.all('po_lines'), this.all('alerts', 'key'), this.all('profiles'),
    ]);
    if (settings.error) throw new Error(`settings: ${settings.error.message}`);
    const poLines = lines.map(fromRow.poLine);
    return {
      settings: fromRow.settings(settings.data as Row),
      locations: locations.map(fromRow.location),
      medicines: medicines.map(fromRow.medicine),
      batches: batches.map(fromRow.batch),
      movements: movements.map(fromRow.movement),
      suppliers: suppliers.map(fromRow.supplier),
      purchaseOrders: pos.map((p) => fromRow.purchaseOrder(p, poLines.filter((l) => l.poId === p.id))),
      alertStates: alerts.map(fromRow.alert),
      profiles: profiles.map(fromRow.profile),
    };
  }

  /**
   * Writes in dependency order. Movements are insert-only (the audit trail cannot be edited).
   * For strict atomicity this can move into a Postgres function later; the change set shape stays the same.
   */
  async commit(cs: ChangeSet): Promise<void> {
    const run = async (p: PromiseLike<{ error: { message: string } | null }>, what: string) => {
      const { error } = await p;
      if (error) throw new Error(`${what}: ${error.message}`);
    };
    if (cs.settings) await run(this.sb.from('settings').upsert(toRow.settings(cs.settings)), 'settings');
    if (cs.locations?.length) await run(this.sb.from('locations').upsert(cs.locations.map(toRow.location)), 'locations');
    if (cs.suppliers?.length) await run(this.sb.from('suppliers').upsert(cs.suppliers.map(toRow.supplier)), 'suppliers');
    if (cs.medicines?.length) await run(this.sb.from('medicines').upsert(cs.medicines.map(toRow.medicine)), 'medicines');
    if (cs.batches?.length) await run(this.sb.from('batches').upsert(cs.batches.map(toRow.batch)), 'batches');
    if (cs.movements?.length) await run(this.sb.from('stock_movements').insert(cs.movements.map(toRow.movement)), 'movements');
    if (cs.purchaseOrders?.length) {
      await run(this.sb.from('purchase_orders').upsert(cs.purchaseOrders.map(toRow.purchaseOrder)), 'purchase orders');
      const lines = cs.purchaseOrders.flatMap((p) => p.lines);
      if (lines.length) await run(this.sb.from('po_lines').upsert(lines.map(toRow.poLine)), 'order lines');
    }
    if (cs.alertStates?.length) await run(this.sb.from('alerts').upsert(cs.alertStates.map(toRow.alert)), 'alerts');
  }
}
