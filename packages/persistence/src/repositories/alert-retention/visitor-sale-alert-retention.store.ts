import type { AlertPruneCounts, AlertRetentionCutoffs, AlertRetentionStore } from "@auction/alerts";
import type { Database } from "@auction/db";
import { visitorSaleAlertSubscriber as v } from "@auction/db/schema";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { DEFAULT_MAX_BATCHES } from "./alert-retention.store.js";

const DEFAULT_BATCH = 500;

/**
 * Prunes Bid's email-only new-sale list by the same rules as the alert engine. This list has no
 * topics, matches or digests, and no complaint status (complaints reach it through the address-level
 * suppression list, which is not touched here), so only the two subscriber rules apply. A confirmed
 * address is never selected.
 */
export class DrizzleVisitorSaleAlertRetentionStore implements AlertRetentionStore {
  readonly name = "visitor_sale";

  constructor(
    private readonly db: Database,
    private readonly batch = DEFAULT_BATCH,
    private readonly maxBatches = DEFAULT_MAX_BATCHES,
  ) {}

  async prune(
    cutoffs: AlertRetentionCutoffs,
    options: { dryRun: boolean },
  ): Promise<AlertPruneCounts> {
    const unconfirmed = await this.remove(
      and(eq(v.status, "pending"), lt(v.requestedAt, cutoffs.unconfirmedBefore)),
      options.dryRun,
    );
    const stopped = await this.remove(
      and(
        eq(v.status, "unsubscribed"),
        sql`coalesce(${v.unsubscribedAt}, ${v.updatedAt}) < ${cutoffs.stoppedBefore}`,
      ),
      options.dryRun,
    );
    return { unconfirmed, stopped, suppressionsTrimmed: 0, matches: 0, digests: 0 };
  }

  private async remove(due: ReturnType<typeof and>, dryRun: boolean): Promise<number> {
    if (dryRun) {
      const [row] = await this.db.select({ n: sql<number>`count(*)::int` }).from(v).where(due);
      return row?.n ?? 0;
    }
    let total = 0;
    for (let round = 0; round < this.maxBatches; round += 1) {
      const rows = await this.db
        .delete(v)
        .where(inArray(v.id, this.db.select({ id: v.id }).from(v).where(due).limit(this.batch)))
        .returning({ id: v.id });
      total += rows.length;
      if (rows.length < this.batch) return total;
    }
    return total;
  }
}
