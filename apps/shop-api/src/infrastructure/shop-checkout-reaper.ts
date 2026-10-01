import type { Database } from "@auction/db";
import { shopOrder } from "@auction/db/schema";
import { and, asc, eq, isNotNull, lt } from "drizzle-orm";
import type pino from "pino";
import type { PaymentCheckoutGateway } from "../application/ports/commerce.ports.js";
import { expireShopCheckoutSession } from "./drizzle-payment-event.processor.js";

const REAPER_BATCH_SIZE = 25;
export const SHOP_CHECKOUT_REAPER_EVENT_SOURCE = "shop-api-reaper";

export function reaperEventIdForOrder(orderId: string): string {
  return `reaper:order:${orderId}`;
}

export async function reapStaleShopCheckouts(
  db: Database,
  now: Date,
  paymentGateway?: PaymentCheckoutGateway,
  log?: pino.Logger,
): Promise<number> {
  const stale = await db
    .select({ id: shopOrder.id })
    .from(shopOrder)
    .where(
      and(
        eq(shopOrder.status, "pending_payment"),
        isNotNull(shopOrder.checkoutExpiresAt),
        lt(shopOrder.checkoutExpiresAt, now),
      ),
    )
    .orderBy(asc(shopOrder.checkoutExpiresAt))
    .limit(REAPER_BATCH_SIZE);

  let expired = 0;
  for (const row of stale) {
    try {
      const outcome = await expireShopCheckoutSession(
        db,
        {
          eventId: reaperEventIdForOrder(row.id),
          orderId: row.id,
          source: SHOP_CHECKOUT_REAPER_EVENT_SOURCE,
        },
        paymentGateway ? { paymentGateway } : {},
      );
      if (outcome === "expired") {
        expired += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (log) {
        log.error({ orderId: row.id, err: message }, "shop checkout reaper failed for order");
      } else {
        console.error(`shop checkout reaper failed for order ${row.id}: ${message}`);
      }
    }
  }
  return expired;
}
