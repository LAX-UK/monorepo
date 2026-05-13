import type { createDb } from "@auction/db";
import { user } from "@auction/db/schema";
import { and, isNotNull, lt, sql } from "drizzle-orm";
import type { Logger } from "pino";

type Db = ReturnType<typeof createDb>;

/**
 * GDPR / data-retention purge after account deletion cooling-off.
 *
 * Selects users who requested deletion more than `graceDays` ago and invokes
 * {@link user_pii_purge} (migration `0058_user_pii_purge.sql`) per row.
 */
export async function purgeSoftDeletedUsers(
  db: Db,
  options: {
    graceDays?: number;
    batchLimit?: number;
    log?: Logger;
    onPurgeUser?: (userId: string) => Promise<void>;
  },
): Promise<{ processed: number }> {
  const graceDays = options.graceDays ?? 30;
  const limit = options.batchLimit ?? 100;
  const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);

  const candidates = await db
    .select({ id: user.id })
    .from(user)
    .where(and(isNotNull(user.deletionRequestedAt), lt(user.deletionRequestedAt, cutoff)))
    .limit(limit);

  let processed = 0;
  for (const row of candidates) {
    try {
      if (options.onPurgeUser) {
        await options.onPurgeUser(row.id);
      } else {
        await db.execute(sql`SELECT user_pii_purge(${row.id})`);
      }
      processed++;
    } catch (err) {
      options.log?.error(
        { userId: row.id, error: err instanceof Error ? err.message : String(err) },
        "purge-soft-deleted-users: failed to purge user",
      );
    }
  }

  options.log?.info({ processed }, "purge-soft-deleted-users: complete");
  return { processed };
}
