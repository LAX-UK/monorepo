import type { SubscriberStore } from "@auction/alerts";
import type { Database } from "@auction/db";
import { shopArtworkInterest } from "@auction/db/schema";
import { type SQL, and, count, eq, isNull, or, sql } from "drizzle-orm";
import type { WaitingAlertCanceller } from "../../application/handlers/shop-alerts.handler.js";

/**
 * The back-in-stock requests still waiting for a subscriber's address or account: a stop from the
 * shared stop page also ends the requests that have not been emailed yet, and the page counts them.
 */
export function createWaitingAlertCanceller(
  db: Database,
  subscribers: Pick<SubscriberStore, "findById">,
): WaitingAlertCanceller {
  /** The waiting requests for the subscriber's address and account; null for an unknown id. */
  async function waitingFor(subscriberId: string): Promise<SQL | null> {
    const record = await subscribers.findById(subscriberId);
    if (!record) return null;
    const owners = [
      sql`lower(${shopArtworkInterest.contactEmail}) = ${record.email.toLowerCase()}`,
      ...(record.subjectId ? [eq(shopArtworkInterest.identitySubjectId, record.subjectId)] : []),
    ];
    return and(
      eq(shopArtworkInterest.intent, "notify_me"),
      isNull(shopArtworkInterest.notifiedAt),
      isNull(shopArtworkInterest.cancelledAt),
      or(...owners),
    ) as SQL;
  }

  return {
    async cancelWaiting(subscriberId, now) {
      const where = await waitingFor(subscriberId);
      if (!where) return 0;
      const stopped = await db
        .update(shopArtworkInterest)
        .set({ cancelledAt: now, updatedAt: now })
        .where(where)
        .returning({ id: shopArtworkInterest.id });
      return stopped.length;
    },

    async countWaiting(subscriberId) {
      const where = await waitingFor(subscriberId);
      if (!where) return 0;
      const [row] = await db.select({ n: count() }).from(shopArtworkInterest).where(where);
      return row?.n ?? 0;
    },
  };
}
