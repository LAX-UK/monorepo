import type { Database } from "@auction/db";
import { shopDeliveryQuote, shopEdition, shopOrder } from "@auction/db/schema";
import { deliveryQuoteTransition } from "@auction/domain";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type VatPolicy,
  orderTotalWithDelivery,
  reservedUntilFromCheckoutExpiry,
  vatIncludedIn,
} from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
import type { DeliveryQuoteAcceptanceStore } from "../application/delivery-quote-acceptance/delivery-quote-acceptance.service.js";
import { ShopApiError } from "../errors/shop-api-error.js";

const conflict = (message: string) => new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, message, 409);

/**
 * Writes an accepted quote into its order. The order and its quote are locked together, the
 * shared quote machine decides whether "accept" is open, and the price, the total, the hold and
 * the reservation change in the same transaction, so a payment can never be opened for an order
 * that does not yet carry the price the buyer agreed to.
 */
export function createDrizzleDeliveryQuoteAcceptanceStore(
  db: Database,
  options: { vatPolicy?: VatPolicy | null } = {},
): DeliveryQuoteAcceptanceStore {
  return {
    async accept(input) {
      await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(shopOrder)
          .where(eq(shopOrder.id, input.orderId))
          .for("update")
          .limit(1);
        // The same answer whether the order is missing or someone else's.
        if (!order || order.identitySubjectId !== input.subject) {
          throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Order not found", 404);
        }
        if (order.fulfilment !== "international_quotation" || order.status !== "pending_payment") {
          throw conflict("This order has no delivery quote to accept");
        }
        const [quote] = await tx
          .select()
          .from(shopDeliveryQuote)
          .where(eq(shopDeliveryQuote.orderId, order.id))
          .for("update")
          .limit(1);
        if (!quote) throw conflict("This order has no delivery quote to accept");

        // Already accepted and priced into the order: a repeat changes nothing.
        if (quote.status === "accepted") return;

        const price = quote.quotedPricePence;
        if (quote.status !== "quoted" || price === null) {
          throw conflict("There is no delivery price to accept yet");
        }
        if (order.checkoutExpiresAt && order.checkoutExpiresAt <= input.now) {
          throw conflict("This quote has expired");
        }
        const step = deliveryQuoteTransition("quoted", "accept", "buyer");
        if (!step.allowed) throw conflict("This quote can no longer be accepted");

        await tx
          .update(shopOrder)
          .set({
            fulfilmentSurchargePence: price,
            fulfilmentVatPence: options.vatPolicy
              ? vatIncludedIn(price, options.vatPolicy.standardRateBp)
              : null,
            // The goods, the framing sold with them and the delivery that was priced.
            totalPence: orderTotalWithDelivery({
              merchandiseSubtotalPence: order.merchandiseSubtotalPence,
              framingSubtotalPence: order.framingSubtotalPence,
              deliveryPence: price,
            }),
            checkoutExpiresAt: input.paymentEndsAt,
            updatedAt: input.now,
          })
          .where(eq(shopOrder.id, order.id));
        await tx
          .update(shopEdition)
          .set({ reservedUntil: reservedUntilFromCheckoutExpiry(input.paymentEndsAt) })
          .where(
            and(
              eq(shopEdition.reservedByOrderId, order.id),
              eq(shopEdition.listingStatus, "reserved"),
            ),
          );
        await tx
          .update(shopDeliveryQuote)
          .set({
            status: step.next,
            holdUntil: input.paymentEndsAt,
            decidedAt: input.now,
            updatedAt: input.now,
          })
          .where(eq(shopDeliveryQuote.id, quote.id));
      });
    },
  };
}
