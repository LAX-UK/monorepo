import type { Database } from "@auction/db";
import { shopOrder } from "@auction/db/schema";
import { asc, eq } from "drizzle-orm";
import type pino from "pino";
import type { CheckoutMoneyPause } from "../application/artwork-register/checkout-money-pause.js";
import {
  type CheckoutTransitionOptions,
  expireShopCheckoutSession,
  orderHoldsPausedArtwork,
} from "./drizzle-payment-event.processor.js";

const SWEEP_BATCH_SIZE = 50;
export const SHOP_CHECKOUT_MONEY_PAUSE_EVENT_SOURCE = "shop-api-money-pause";

export function moneyPauseEventIdForOrder(orderId: string): string {
  return `money-pause:order:${orderId}`;
}

/**
 * Ends the payment pages of orders waiting for payment whose artwork Zoho now says is Sold or
 * Reserved. The checkout guards only stop LAX opening or returning a page; one opened before the
 * item was raised would otherwise stay payable until its hold ran out. Each order goes through the
 * same expiry the reaper uses: Stripe is asked to end the session first, a payment that already
 * went through is applied (and, being for a paused artwork, recorded for finance instead of
 * fulfilled), and otherwise the order expires, its prints are released and the basket restored.
 * Safe to repeat; an order that fails is left for the next run.
 */
export async function expirePausedShopCheckouts(
  db: Database,
  guard: CheckoutMoneyPause,
  options: CheckoutTransitionOptions = {},
  log?: pino.Logger,
): Promise<number> {
  const pending = await db
    .select({ id: shopOrder.id })
    .from(shopOrder)
    .where(eq(shopOrder.status, "pending_payment"))
    .orderBy(asc(shopOrder.createdAt))
    .limit(SWEEP_BATCH_SIZE * 20);

  let expired = 0;
  for (const { id } of pending) {
    try {
      if (!(await orderHoldsPausedArtwork(db, id, guard))) continue;
      const outcome = await expireShopCheckoutSession(
        db,
        {
          eventId: moneyPauseEventIdForOrder(id),
          orderId: id,
          source: SHOP_CHECKOUT_MONEY_PAUSE_EVENT_SOURCE,
        },
        options,
      );
      if (outcome === "expired") expired += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (log) log.error({ orderId: id, err: message }, "shop money-pause sweep failed for order");
      else console.error(`shop money-pause sweep failed for order ${id}: ${message}`);
    }
  }
  return expired;
}
