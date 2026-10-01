import type { MediStockRepository } from '../repository.ts';
import type { ChangeSet, Dataset, Profile } from '../types.ts';
import { applyChangeSet } from '../operations.ts';
import { DEMO_USERS, generateSeed } from './seed.ts';

/** Minimal key-value storage: window.localStorage on web, AsyncStorage-backed shim on mobile. */
export interface KeyValueStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

const DATA_KEY = 'medistock.demo.dataset.v1';
const USER_KEY = 'medistock.demo.user.v1';

/** Demo backend: seeded data kept in local storage. Same interface as the Supabase repository. */
export class DemoRepository implements MediStockRepository {
  readonly mode = 'demo' as const;
  private ds: Dataset | null = null;
  private storage: KeyValueStorage | null;
  constructor(storage: KeyValueStorage | null) {
    this.storage = storage;
  }

  private async read<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.storage?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
  private async write(key: string, value: unknown) {
    try { await this.storage?.setItem(key, JSON.stringify(value)); } catch { /* storage full or unavailable: keep in memory */ }
  }

  async currentUser(): Promise<Profile | null> {
    return this.read<Profile>(USER_KEY);
  }

  async signIn(email: string, password: string): Promise<Profile> {
    const u = DEMO_USERS.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.password !== password) throw new Error('Email or password is incorrect.');
    const { password: _p, ...profile } = u;
    await this.write(USER_KEY, profile);
    return profile;
  }

  async signOut(): Promise<void> {
    try { await this.storage?.removeItem(USER_KEY); } catch { /* ignore */ }
  }

  async load(): Promise<Dataset> {
    if (!this.ds) {
      this.ds = (await this.read<Dataset>(DATA_KEY)) ?? generateSeed();
      await this.write(DATA_KEY, this.ds);
    }
    return this.ds;
  }

  async commit(changes: ChangeSet): Promise<void> {
    this.ds = applyChangeSet(await this.load(), changes);
    await this.write(DATA_KEY, this.ds);
  }

  async reset(): Promise<void> {
    this.ds = generateSeed();
    await this.write(DATA_KEY, this.ds);
  }
}
