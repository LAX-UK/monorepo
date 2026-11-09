import type { Database } from "@auction/db";
import { shopEdition, shopOrder } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { planSessionHold, reservedUntilFromCheckoutExpiry } from "@auction/shop-domain";
import { and, eq, gt, isNull } from "drizzle-orm";
import { ShopApiError } from "../errors/shop-api-error.js";

const HOLD_TOO_OLD_TO_EXTEND =
  "The time to pay for this order has run out. It will be released shortly and your basket restored, so you can start again.";
const QUOTE_TOO_OLD_TO_EXTEND =
  "The time to pay for this quote has run out. Your print will be released shortly, and you can ask for a new delivery quote from your basket.";

/**
 * Moves the order's hold and the prints' reservation to `endsAt` in one write, before a payment
 * session that lasts that long is opened. The reaper reads the order's hold and Stripe reads the
 * session's expiry, so both must name the same moment: a session that outlives the hold could be
 * paid after the prints were released.
 *
 * Only an order still waiting for payment, with no session yet and a hold that has not ended, is
 * moved: a second request cannot stretch a hold that already has a session behind it, and a hold
 * the reaper is about to end cannot be brought back from under it.
 */
export async function extendCheckoutHold(
  db: Database,
  orderId: string,
  endsAt: Date,
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [moved] = await tx
      .update(shopOrder)
      .set({ checkoutExpiresAt: endsAt, updatedAt: now })
      .where(
        and(
          eq(shopOrder.id, orderId),
          eq(shopOrder.status, "pending_payment"),
          isNull(shopOrder.stripeCheckoutSessionId),
          gt(shopOrder.checkoutExpiresAt, now),
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

/**
 * The hold a payment session about to be created can last, following the domain's plan: kept when
 * long enough, stretched (order and reservation together) when not, refused when stretching would
 * pass the ceiling. The refusal says what happens next, for a quote or for an ordinary order.
 */
export async function holdForNewSession(
  db: Database,
  order: { id: string; checkoutExpiresAt: Date },
  input: { began: Date; now: Date; isQuote: boolean },
): Promise<Date> {
  const plan = planSessionHold({
    holdEndsAt: order.checkoutExpiresAt,
    began: input.began,
    now: input.now,
  });
  if (plan.kind === "keep") return plan.endsAt;
  if (plan.kind === "refuse") {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.CONFLICT,
      input.isQuote ? QUOTE_TOO_OLD_TO_EXTEND : HOLD_TOO_OLD_TO_EXTEND,
      409,
    );
  }
  await extendCheckoutHold(db, order.id, plan.endsAt, input.now);
  return plan.endsAt;
}
