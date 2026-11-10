import type { Database } from "@auction/db";
import { sql } from "drizzle-orm";

/**
 * Waits, for a bounded time, until a statement on the named claims table is blocked on a lock:
 * the proof that a second delivery of an event is waiting on the first one's uncommitted claim.
 */
export async function claimIsBlockedOnLock(
  db: Database,
  claimsTable: string,
  { attempts = 50, pauseMs = 100 } = {},
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await db.execute(
      sql`select 1 from pg_stat_activity
          where datname = current_database()
            and wait_event_type = 'Lock'
            and query ilike ${`%${claimsTable}%`}`,
    );
    if (result.rows.length > 0) return true;
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }
  return false;
}
