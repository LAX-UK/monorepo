import type { Database } from "@auction/db";
import { marketingClickIds } from "@auction/db/schema";
import { lt } from "drizzle-orm";
import type { Logger } from "pino";

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export async function purgeStaleMarketingClickIds(input: {
  db: Database;
  log: Logger;
}): Promise<number> {
  const staleBefore = new Date(Date.now() - RETENTION_MS);
  const deleted = await input.db
    .delete(marketingClickIds)
    .where(lt(marketingClickIds.updatedAt, staleBefore))
    .returning({ userId: marketingClickIds.userId });
  if (deleted.length > 0) {
    input.log.info({ count: deleted.length, staleBefore }, "purged stale marketing click ids");
  }
  return deleted.length;
}
