import type { Database } from "@auction/db";
import type pg from "pg";

/** Session-scoped lock so only one shop-api replica runs scheduled work per tick. */
export const SHOP_SCHEDULER_ADVISORY_LOCK_KEY = 0x73686f70_73636801n;

type DatabaseWithPool = Database & { $client: pg.Pool };

/** Acquire and release the lock on one pooled connection (session-scoped advisory lock). */
export async function runWithShopSchedulerLock(
  db: Database,
  fn: () => Promise<void>,
): Promise<boolean> {
  const pool = (db as DatabaseWithPool).$client;
  const client = await pool.connect();
  let acquired = false;
  try {
    const result = await client.query<{ acquired: boolean }>(
      "select pg_try_advisory_lock($1::bigint) as acquired",
      [SHOP_SCHEDULER_ADVISORY_LOCK_KEY.toString()],
    );
    acquired = result.rows[0]?.acquired === true;
    if (!acquired) {
      return false;
    }
    await fn();
    return true;
  } finally {
    if (acquired) {
      await client.query("select pg_advisory_unlock($1::bigint)", [
        SHOP_SCHEDULER_ADVISORY_LOCK_KEY.toString(),
      ]);
    }
    client.release();
  }
}
