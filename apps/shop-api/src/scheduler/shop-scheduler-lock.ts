import type { Database } from "@auction/db";
import type pg from "pg";

/** Session-scoped lock so only one shop-api replica runs scheduled work per tick. */
export const SHOP_SCHEDULER_ADVISORY_LOCK_KEY = 0x73686f70_73636801n;

type DatabaseWithPool = Database & { $client: pg.Pool };

const asError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));

/**
 * Acquire and release the lock on one pooled connection (session-scoped advisory lock).
 *
 * The connection always goes back to the pool. If the lock query or the unlock fails, the
 * connection is in an unknown state (a session lock may still be held on it), so it is
 * destroyed rather than returned: closing the session releases the lock on the server.
 */
export async function runWithShopSchedulerLock(
  db: Database,
  fn: () => Promise<void>,
): Promise<boolean> {
  const pool = (db as DatabaseWithPool).$client;
  const client = await pool.connect();
  let acquired = false;
  let discard: Error | undefined;
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
  } catch (error) {
    // The scheduler's `fn` handles each task's errors itself, so anything reaching here is a
    // problem with this session.
    discard = asError(error);
    throw error;
  } finally {
    if (acquired && !discard) {
      try {
        await client.query("select pg_advisory_unlock($1::bigint)", [
          SHOP_SCHEDULER_ADVISORY_LOCK_KEY.toString(),
        ]);
      } catch (unlockError) {
        discard = asError(unlockError);
      }
    }
    client.release(discard);
  }
}
