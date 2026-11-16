import type { Db, PeopleIds } from "../demo-topup-seed.js";

/** What every queue seeder needs: the database, the clock and the people the demo already has. */
export type QueueContext = {
  db: Db;
  now: number;
  people: PeopleIds;
  /** Staff accounts that raise or review items. */
  staff: { adminUserId: string };
  /** The house account that owns the demo collection point. */
  laxStockId: string;
  /** The two private sale enquiries the full demo seed writes (to buy, to sell). */
  enquiryIds: { buy: string; sell: string };
};

/**
 * One seeder fills one staff queue. Each is idempotent: fixed ids, `on conflict` writes, and rows
 * that depend on the clock are refreshed so they stay due, overdue or upcoming whenever it runs.
 */
export interface QueueSeeder {
  /** The staff queue or screen this seeder fills, for logs and tests. */
  readonly queue: string;
  seed(context: QueueContext): Promise<void>;
}
