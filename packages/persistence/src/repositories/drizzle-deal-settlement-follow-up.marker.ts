import type { Database } from "@auction/db";
import { domainEvent } from "@auction/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { IDealSettlementFollowUpMarker } from "../interfaces/deal-settlement-follow-up.marker.js";

const AGGREGATE_TYPE = "private_sale_deal";
const RAISED_EVENT = "private_sale_deal.settlement_follow_up_raised";

/**
 * Reads the audit log for a deal's "raised" event rather than keeping a second record: the event
 * is written in the same transaction as the claim, so the two cannot disagree.
 */
export class DrizzleDealSettlementFollowUpMarker implements IDealSettlementFollowUpMarker {
  async claimInTransaction(tx: Database, dealId: string): Promise<boolean> {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${RAISED_EVENT}:${dealId}`}, 0))`,
    );
    const [existing] = await tx
      .select({ id: domainEvent.id })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateType, AGGREGATE_TYPE),
          eq(domainEvent.aggregateId, dealId),
          eq(domainEvent.eventType, RAISED_EVENT),
        ),
      )
      .limit(1);
    return !existing;
  }
}
