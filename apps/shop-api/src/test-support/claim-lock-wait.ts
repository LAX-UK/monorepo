import type pg from "pg";

/**
 * Waits, for a bounded time, until a statement on the named claims table is blocked on a lock:
 * the proof that a second delivery of an event is waiting on the first one's uncommitted claim.
 */
export async function claimIsBlockedOnLock(
  ownerPool: pg.Pool,
  claimsTable: string,
  { attempts = 50, pauseMs = 100 } = {},
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { rowCount } = await ownerPool.query(
      `select 1 from pg_stat_activity
       where datname = current_database()
         and wait_event_type = 'Lock'
         and query ilike $1`,
      [`%${claimsTable}%`],
    );
    if (rowCount) return true;
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }
  return false;
}
