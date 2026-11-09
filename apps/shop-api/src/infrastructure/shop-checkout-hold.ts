import type { Database } from "@auction/db";
import { shopEdition, shopOrder } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { reservedUntilFromCheckoutExpiry } from "@auction/shop-domain";
import { and, eq, isNull } from "drizzle-orm";
import { ShopApiError } from "../errors/shop-api-error.js";

/**
 * Stripe refuses a Checkout Session that expires less than 30 minutes after it is created. One
 * extra minute covers the time between choosing the expiry and Stripe receiving the request.
 */
export const STRIPE_SESSION_MIN_LIFETIME_MS = 31 * 60 * 1000;

/** When a payment session opened at `now` may end: the order's hold, or the minimum if sooner. */
export function sessionEndFor(holdEndsAt: Date, now: Date): Date {
  const earliest = new Date(now.getTime() + STRIPE_SESSION_MIN_LIFETIME_MS);
  return holdEndsAt < earliest ? earliest : holdEndsAt;
}

/**
 * Moves the order's hold and the prints' reservation to `endsAt` in one write, before a payment
 * session that lasts that long is opened. The reaper reads the order's hold and Stripe reads the
 * session's expiry, so both must name the same moment: a session that outlives the hold could be
 * paid after the prints were released.
 *
 * Only an order still waiting for payment with no session is moved, so a second request cannot
 * stretch a hold that already has a session behind it.
 */
export async function extendCheckoutHold(
  db: Database,
  orderId: string,
  endsAt: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [moved] = await tx
      .update(shopOrder)
      .set({ checkoutExpiresAt: endsAt, updatedAt: new Date() })
      .where(
        and(
          eq(shopOrder.id, orderId),
          eq(shopOrder.status, "pending_payment"),
          isNull(shopOrder.stripeCheckoutSessionId),
        ),
      )
      .returning({ id: shopOrder.id });
    if (!moved) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Order is no longer checkoutable", 409);
    }
    await tx
      .update(shopEdition)
      .set({ reservedUntil: reservedUntilFromCheckoutExpiry(endsAt) })
      .where(
        and(eq(shopEdition.reservedByOrderId, orderId), eq(shopEdition.listingStatus, "reserved")),
      );
  });
}
