import type { Database } from "@auction/db";
import { domainEvent, shopProjectionCursor } from "@auction/db/schema";
import { userEmailVerifiedPayloadSchemaV1 } from "@auction/types";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { GuestOrderClaimer } from "../../application/ports/guest-checkout.ports.js";

export const GUEST_ORDER_CLAIM_CURSOR = "shop_guest_order_claim";
const BATCH = 50;

/**
 * Follows Identity's `user.email_verified` events: when someone verifies an email that a guest
 * used at checkout, the guest's orders move to that account and appear in its order history.
 * The cursor only moves past an event once its claim has committed.
 */
export function createClaimGuestOrdersRunner(
  db: Database,
  claimer: GuestOrderClaimer,
): () => Promise<{ processed: number; claimedOrders: number }> {
  return async () => {
    await db
      .insert(shopProjectionCursor)
      .values({ name: GUEST_ORDER_CLAIM_CURSOR, lastEventId: 0 })
      .onConflictDoNothing();
    const [state] = await db
      .select({ cursor: shopProjectionCursor.lastEventId })
      .from(shopProjectionCursor)
      .where(eq(shopProjectionCursor.name, GUEST_ORDER_CLAIM_CURSOR))
      .limit(1);
    const cursor = state?.cursor ?? 0;
    const rows = await db
      .select({ id: domainEvent.id, payload: domainEvent.payload })
      .from(domainEvent)
      .where(and(eq(domainEvent.eventType, "user.email_verified"), gt(domainEvent.id, cursor)))
      .orderBy(asc(domainEvent.id))
      .limit(BATCH);

    let processed = 0;
    let claimedOrders = 0;
    for (const row of rows) {
      const payload = userEmailVerifiedPayloadSchemaV1.safeParse(row.payload);
      if (payload.success) {
        const result = await claimer.claimForVerifiedEmail({
          subjectId: payload.data.userId,
          email: payload.data.email,
        });
        claimedOrders += result.claimedOrders;
      }
      await db
        .update(shopProjectionCursor)
        .set({ lastEventId: row.id, updatedAt: sql`now()` })
        .where(eq(shopProjectionCursor.name, GUEST_ORDER_CLAIM_CURSOR));
      processed += 1;
    }
    return { processed, claimedOrders };
  };
}
