import type { Database } from "@auction/db";
import { shopDeliveryQuote } from "@auction/db/schema";
import { deliveryQuoteTransition } from "@auction/domain";
import type { DeliveryQuoteEndReason } from "@auction/shop-domain";
import { eq } from "drizzle-orm";

/**
 * Ends the delivery quote of an order whose hold has ended: the buyer cancelled it, or it was
 * not paid in time. The quote takes the shared "withdraw" step, so a quote that cannot be
 * withdrawn (already accepted) is left as it is. An order with no quote is not an error: orders
 * that never asked for one pass through here too.
 */
export async function closeDeliveryQuoteForOrder(
  tx: Database,
  orderId: string,
  reason: Extract<DeliveryQuoteEndReason, "cancelled_by_buyer" | "expired">,
  at: Date = new Date(),
): Promise<void> {
  const [quote] = await tx
    .select({ id: shopDeliveryQuote.id, status: shopDeliveryQuote.status })
    .from(shopDeliveryQuote)
    .where(eq(shopDeliveryQuote.orderId, orderId))
    .for("update")
    .limit(1);
  if (!quote) return;
  const step = deliveryQuoteTransition(
    quote.status as Parameters<typeof deliveryQuoteTransition>[0],
    "withdraw",
    "buyer",
  );
  if (!step.allowed) return;
  await tx
    .update(shopDeliveryQuote)
    .set({ status: step.next, endReason: reason, decidedAt: at, updatedAt: at })
    .where(eq(shopDeliveryQuote.id, quote.id));
}
