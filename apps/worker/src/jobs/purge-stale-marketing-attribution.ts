import type { Database } from "@auction/db";
import { marketingAttribution } from "@auction/db/schema";
import { lt } from "drizzle-orm";
import type { Logger } from "pino";

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export async function purgeStaleMarketingAttribution(input: {
  db: Database;
  log: Logger;
}): Promise<number> {
  const staleBefore = new Date(Date.now() - RETENTION_MS);
  const deleted = await input.db
    .delete(marketingAttribution)
    .where(lt(marketingAttribution.updatedAt, staleBefore))
    .returning({ userId: marketingAttribution.userId });
  const count = deleted.length;
  if (count > 0) {
    input.log.info({ count, staleBefore }, "purged stale marketing attribution snapshots");
  }
  return count;
}
