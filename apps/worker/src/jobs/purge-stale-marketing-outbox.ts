import type { Database } from "@auction/db";
import { marketingEventOutbox } from "@auction/db/schema";
import { and, inArray, lt } from "drizzle-orm";
import type { Logger } from "pino";

const TERMINAL_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function purgeStaleMarketingOutbox(input: {
  db: Database;
  log: Logger;
}): Promise<number> {
  const staleBefore = new Date(Date.now() - TERMINAL_RETENTION_MS);
  const deleted = await input.db
    .delete(marketingEventOutbox)
    .where(
      and(
        inArray(marketingEventOutbox.state, ["sent", "skipped", "failed"]),
        lt(marketingEventOutbox.createdAt, staleBefore),
      ),
    )
    .returning({ id: marketingEventOutbox.id });
  if (deleted.length > 0) {
    input.log.info({ count: deleted.length, staleBefore }, "purged stale marketing outbox rows");
  }
  return deleted.length;
}
