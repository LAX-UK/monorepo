import type { SubscriberStore } from "@auction/alerts";
import type { Database } from "@auction/db";
import { shopArtworkInterest } from "@auction/db/schema";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { WaitingAlertCanceller } from "../../application/handlers/shop-alerts.handler.js";

/**
 * Closes the back-in-stock requests still waiting for a subscriber's address or account, so a stop
 * from the shared stop page also ends the requests that have not been emailed yet.
 */
export function createWaitingAlertCanceller(
  db: Database,
  subscribers: Pick<SubscriberStore, "findById">,
): WaitingAlertCanceller {
  return {
    async cancelWaiting(subscriberId, now) {
      const record = await subscribers.findById(subscriberId);
      if (!record) return 0;
      const owners = [
        sql`lower(${shopArtworkInterest.contactEmail}) = ${record.email.toLowerCase()}`,
        ...(record.subjectId ? [eq(shopArtworkInterest.identitySubjectId, record.subjectId)] : []),
      ];
      const stopped = await db
        .update(shopArtworkInterest)
        .set({ cancelledAt: now, updatedAt: now })
        .where(
          and(
            eq(shopArtworkInterest.intent, "notify_me"),
            isNull(shopArtworkInterest.notifiedAt),
            isNull(shopArtworkInterest.cancelledAt),
            or(...owners),
          ),
        )
        .returning({ id: shopArtworkInterest.id });
      return stopped.length;
    },
  };
}
