import type { Database } from "@auction/db";
import { domainEvent, shopProjectionCursor } from "@auction/db/schema";
import {
  userEmailVerifiedPayloadSchemaV1,
  userProfileUpdatedPayloadSchemaV1,
} from "@auction/types";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import type { GuestOrderClaimer } from "../../application/ports/guest-checkout.ports.js";

export const GUEST_ORDER_CLAIM_CURSOR = "shop_guest_order_claim";
const BATCH = 50;

/** The identity events that prove an account holds an email. */
const VERIFIED_EMAIL_EVENTS = ["user.email_verified", "user.profile_updated"] as const;

/**
 * The account and the email it has just verified, or null when the event proves nothing: a
 * profile update counts only when it carries an email marked as verified (a change of email
 * both inboxes confirmed).
 */
export function verifiedEmailFromEvent(
  eventType: string,
  payload: unknown,
): { subjectId: string; email: string } | null {
  if (eventType === "user.email_verified") {
    const parsed = userEmailVerifiedPayloadSchemaV1.safeParse(payload);
    return parsed.success ? { subjectId: parsed.data.userId, email: parsed.data.email } : null;
  }
  if (eventType === "user.profile_updated") {
    const parsed = userProfileUpdatedPayloadSchemaV1.safeParse(payload);
    if (!parsed.success || parsed.data.emailVerified !== true || !parsed.data.email) return null;
    return { subjectId: parsed.data.subjectId, email: parsed.data.email };
  }
  return null;
}

/**
 * Follows Identity's events: when someone verifies an email that a guest used, on sign-up or by
 * changing their account's email, the guest's orders and enquiries move to that account. The
 * cursor only moves past an event once its claim has committed.
 */
export function createClaimGuestOrdersRunner(
  db: Database,
  claimer: GuestOrderClaimer,
): () => Promise<{ processed: number; claimedOrders: number; claimedEnquiries: number }> {
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
      .select({
        id: domainEvent.id,
        eventType: domainEvent.eventType,
        payload: domainEvent.payload,
      })
      .from(domainEvent)
      .where(
        and(inArray(domainEvent.eventType, [...VERIFIED_EMAIL_EVENTS]), gt(domainEvent.id, cursor)),
      )
      .orderBy(asc(domainEvent.id))
      .limit(BATCH);

    let processed = 0;
    let claimedOrders = 0;
    let claimedEnquiries = 0;
    for (const row of rows) {
      const verified = verifiedEmailFromEvent(row.eventType, row.payload);
      if (verified) {
        const result = await claimer.claimForVerifiedEmail(verified);
        claimedOrders += result.claimedOrders;
        claimedEnquiries += result.claimedEnquiries;
      }
      await db
        .update(shopProjectionCursor)
        .set({ lastEventId: row.id, updatedAt: sql`now()` })
        .where(eq(shopProjectionCursor.name, GUEST_ORDER_CLAIM_CURSOR));
      processed += 1;
    }
    return { processed, claimedOrders, claimedEnquiries };
  };
}
