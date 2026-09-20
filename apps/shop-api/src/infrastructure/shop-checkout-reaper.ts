import type { Database } from "@auction/db";
import { shopOrder } from "@auction/db/schema";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { expireShopCheckoutSession } from "./drizzle-payment-event.processor.js";

const REAPER_BATCH_SIZE = 25;
export const SHOP_CHECKOUT_REAPER_EVENT_SOURCE = "shop-api-reaper";

export function reaperEventIdForOrder(orderId: string): string {
  return `reaper:order:${orderId}`;
}

export async function reapStaleShopCheckouts(db: Database, now: Date): Promise<number> {
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
    .limit(REAPER_BATCH_SIZE);

  let processed = 0;
  for (const row of stale) {
    await expireShopCheckoutSession(db, {
      eventId: reaperEventIdForOrder(row.id),
      orderId: row.id,
      source: SHOP_CHECKOUT_REAPER_EVENT_SOURCE,
    });
    processed += 1;
  }
  return processed;
}
