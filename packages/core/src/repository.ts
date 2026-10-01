import type { ChangeSet, Dataset, Profile } from './types.ts';

/**
 * The single data interface both apps talk to.
 * Reads return the whole dataset (a pharmacy holds thousands of rows, not millions);
 * writes are change sets produced by the pure functions in operations.ts.
 */
export interface MediStockRepository {
  readonly mode: 'demo' | 'supabase';
  currentUser(): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  load(): Promise<Dataset>;
  commit(changes: ChangeSet): Promise<void>;
  /** Demo only: restore the seeded data. */
  reset?(): Promise<void>;
}
