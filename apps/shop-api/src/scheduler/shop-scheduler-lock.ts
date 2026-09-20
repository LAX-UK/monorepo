import type { Database } from "@auction/db";
import { sql } from "drizzle-orm";

/** Session-scoped lock so only one shop-api replica runs scheduled work per tick. */
export const SHOP_SCHEDULER_ADVISORY_LOCK_KEY = 0x73686f70_73636801n;

export async function tryAcquireShopSchedulerLock(db: Database): Promise<boolean> {
  const result = await db.execute(sql`
    select pg_try_advisory_lock(${SHOP_SCHEDULER_ADVISORY_LOCK_KEY.toString()}::bigint) as acquired
  `);
  const row = result.rows[0] as { acquired?: boolean } | undefined;
  return row?.acquired === true;
}

export async function releaseShopSchedulerLock(db: Database): Promise<void> {
  await db.execute(sql`
    select pg_advisory_unlock(${SHOP_SCHEDULER_ADVISORY_LOCK_KEY.toString()}::bigint)
  `);
}
