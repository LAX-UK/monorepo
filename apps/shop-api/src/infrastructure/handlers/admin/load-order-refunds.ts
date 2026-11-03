import { shopRefund } from "@auction/db/schema";
import type { RefundLineInput } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import type { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";

/** Every refund on an order, as the refundable-balance rules read it. */
export async function loadOrderRefunds(
  db: ReturnType<typeof shopPhaseDbSession>,
  orderId: string,
): Promise<Array<RefundLineInput & { refundId: string }>> {
  const rows = await db
    .select({
      refundId: shopRefund.id,
      amountPence: shopRefund.amountPence,
      status: shopRefund.status,
      orderLineId: shopRefund.orderLineId,
      source: shopRefund.source,
    })
    .from(shopRefund)
    .where(eq(shopRefund.orderId, orderId));
  return rows;
}
