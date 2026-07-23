import type { Database } from "@auction/db";
import { marketingAttribution, marketingClickIds } from "@auction/db/schema";
import { lt } from "drizzle-orm";
import type { Logger } from "pino";

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export async function purgeStaleMarketingClickIds(input: {
  db: Database;
  log: Logger;
}): Promise<number> {
  const staleBefore = new Date(Date.now() - RETENTION_MS);
  const deletedClickIds = await input.db
    .delete(marketingClickIds)
    .where(lt(marketingClickIds.updatedAt, staleBefore))
    .returning({ userId: marketingClickIds.userId });
  const deletedAttribution = await input.db
    .delete(marketingAttribution)
    .where(lt(marketingAttribution.updatedAt, staleBefore))
    .returning({ userId: marketingAttribution.userId });
  const count = deletedClickIds.length + deletedAttribution.length;
  if (count > 0) {
    input.log.info(
      {
        clickIds: deletedClickIds.length,
        attribution: deletedAttribution.length,
        staleBefore,
      },
      "purged stale marketing click ids and attribution",
    );
  }
  return count;
}
