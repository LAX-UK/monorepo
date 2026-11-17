import type { Database } from "@auction/db";
import { shopOrder } from "@auction/db/schema";
import { type ExpressShippingRateId, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq, isNull, or } from "drizzle-orm";
import { expressShippingRate } from "../application/express-checkout/express-shipping-rates.js";
import type {
  CheckoutOrderResult,
  ExpressShippingDetails,
} from "../application/ports/commerce.ports.js";
import type { ExpressCheckoutGateway } from "../application/ports/express-checkout.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";

export const EXPRESS_BASKET_CHANGED_MESSAGE =
  "Your basket changed while you were paying. Check it and try again.";
export const EXPRESS_SESSION_ENDED_MESSAGE =
  "This payment has ended. Start again from your basket.";

function substituteOrderId(url: string, orderId: string): string {
  return url.replaceAll("{ORDER_ID}", orderId);
}

/**
 * Binds an order made on an express confirm to the Elements-mode session the shopper confirmed
 * in, so the session pays exactly this order:
 *  1. the session must be one the Shop opened for this basket, still open, and not bound to
 *     another order; its line items must still be the order's goods (a basket that changed after
 *     the sheet opened is refused and its hold released, so the shopper can start again);
 *  2. the order records the session, as the hosted page's orders do, so the webhook and the
 *     reaper treat both alike;
 *  3. Stripe gets the order id and reference (the webhook reads them), the chosen rate as the
 *     only rate and the wallet's address; the session's new total must be the order's.
 *
 * `release` cancels the order and puts its prints back; it is used only where the order can never
 * be paid through this session. A Stripe call that fails leaves the order and its hold in place,
 * so the shopper's retry (the same session, so the same order) binds it again.
 */
export async function bindExpressCheckoutSession(
  db: Database,
  gateway: ExpressCheckoutGateway,
  input: {
    orderId: string;
    orderReference: string | null;
    basketId: string;
    sessionId: string;
    fulfilment: string;
    totalPence: number;
    fulfilmentSurchargePence: number;
    shipping: ExpressShippingDetails;
    successUrl: string;
    checkoutExpiresAt: Date;
    release: () => Promise<void>;
  },
): Promise<CheckoutOrderResult> {
  const result: CheckoutOrderResult = {
    orderId: input.orderId,
    checkoutUrl: substituteOrderId(input.successUrl, input.orderId),
    expiresAt: input.checkoutExpiresAt,
  };
  const rate = expressShippingRate(input.fulfilment as ExpressShippingRateId);
  if (rate.amountPence !== input.fulfilmentSurchargePence) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.INTERNAL,
      "Express delivery rate does not match the order",
      500,
    );
  }

  const snapshot = await gateway.readExpressCheckout({ sessionId: input.sessionId });
  if (!snapshot?.isShopExpress || snapshot.basketId !== input.basketId) {
    await input.release();
    throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Express checkout not found", 404);
  }
  if (snapshot.orderId && snapshot.orderId !== input.orderId) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, EXPRESS_SESSION_ENDED_MESSAGE, 409);
  }
  if (snapshot.status === "complete" && snapshot.orderId === input.orderId) {
    // Already paid for this order: the webhook settles it.
    return result;
  }
  if (snapshot.status !== "open") {
    await input.release();
    throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, EXPRESS_SESSION_ENDED_MESSAGE, 409);
  }
  if (
    snapshot.currency !== "gbp" ||
    snapshot.amountSubtotalPence !== input.totalPence - input.fulfilmentSurchargePence
  ) {
    await input.release();
    throw new ShopApiError(SHOP_API_ERROR_CODES.PRICE_CHANGED, EXPRESS_BASKET_CHANGED_MESSAGE, 409);
  }

  const [attached] = await db
    .update(shopOrder)
    .set({ stripeCheckoutSessionId: input.sessionId, updatedAt: new Date() })
    .where(
      and(
        eq(shopOrder.id, input.orderId),
        eq(shopOrder.status, "pending_payment"),
        or(
          isNull(shopOrder.stripeCheckoutSessionId),
          eq(shopOrder.stripeCheckoutSessionId, input.sessionId),
        ),
      ),
    )
    .returning({ id: shopOrder.id });
  if (!attached) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Order is no longer checkoutable", 409);
  }

  const bound = await gateway.bindExpressCheckout({
    sessionId: input.sessionId,
    orderId: input.orderId,
    orderReference: input.orderReference,
    basketId: input.basketId,
    shippingRate: rate,
    shipping: input.shipping,
    idempotencyKey: `checkout:shop-express-bind:${input.orderId}`,
  });
  if (bound.amountTotalPence !== input.totalPence) {
    // Never let a session be paid for a different amount than its order.
    await input.release();
    throw new ShopApiError(SHOP_API_ERROR_CODES.PRICE_CHANGED, EXPRESS_BASKET_CHANGED_MESSAGE, 409);
  }
  return result;
}
