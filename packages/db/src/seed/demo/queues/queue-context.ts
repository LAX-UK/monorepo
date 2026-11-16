import type { Db, PeopleIds } from "../demo-topup-seed.js";

/** What every queue seeder needs: the database, the clock and the people the demo already has. */
export type QueueContext = {
  db: Db;
  now: number;
  people: PeopleIds;
  /** Staff accounts that raise or review items. */
  staff: { adminUserId: string };
  /** The house account that owns the demo collection point and sells its lots. */
  laxStockId: string;
  /** Northbank Gallery, the demo's organisation buyer. */
  northbankId: string;
  /** Category ids by slug, for the works the seeders submit. */
  categoryIdBySlug: ReadonlyMap<string, string>;
};

/**
 * One seeder fills one staff queue. Each writes only rows it owns, keyed on fixed ids, and only
 * when they are absent: a row it created is never changed again, so what staff do to an item (and
 * the item's own history) survives every later run. It writes what the real service writes beside
 * the row (domain events, history, audit), with the demo seed's producer on its events.
 */
export interface QueueSeeder {
  /** The staff queue or screen this seeder fills, for logs and tests. */
  readonly queue: string;
  seed(context: QueueContext): Promise<void>;
}
