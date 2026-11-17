import type { Database } from "@auction/db";
import { shopOrder } from "@auction/db/schema";
import { type ExpressShippingRateId, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq, isNull, or } from "drizzle-orm";
import { expressShippingRate } from "../application/express-checkout/express-shipping-rates.js";
import type {
  CheckoutOrderResult,
  ExpressShippingDetails,
} from "../application/ports/commerce.ports.js";
import type {
  ExpressCheckoutGateway,
  ExpressCheckoutSnapshot,
} from "../application/ports/express-checkout.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";

export const EXPRESS_BASKET_CHANGED_MESSAGE =
  "Your basket changed while you were paying. Check it and try again.";
export const EXPRESS_SESSION_ENDED_MESSAGE =
  "This payment has ended. Start again from your basket.";
export const EXPRESS_PAYMENT_NOT_READY_MESSAGE =
  "We couldn't set up this payment, so you have not been charged. Start again from your basket.";

/** Logged when Stripe's session does not match its order after a bind, for staff to look into. */
export const SHOP_EXPRESS_BIND_MISMATCH = "shop_express_bind_mismatch";

function samePostcode(a: string, b: string): boolean {
  const normal = (value: string) => value.replace(/\s+/g, "").toUpperCase();
  return normal(a) === normal(b);
}

/**
 * Why the session Stripe has now does not pay exactly this order, or null when it does: the
 * total, the one delivery rate and the shipping details must all be what the bind set.
 */
export function expressBindMismatch(
  session: ExpressCheckoutSnapshot | null,
  expected: {
    orderId: string;
    totalPence: number;
    fulfilmentSurchargePence: number;
    shipping: ExpressShippingDetails;
  },
): string | null {
  if (!session) return "session_missing";
  if (session.status !== "open") return "session_not_open";
  if (session.orderId !== expected.orderId) return "order_id";
  if (session.currency !== "gbp") return "currency";
  if (session.amountTotalPence !== expected.totalPence) return "amount_total";
  if (
    session.shippingOptionAmountsPence.length !== 1 ||
    session.shippingOptionAmountsPence[0] !== expected.fulfilmentSurchargePence
  ) {
    return "shipping_option";
  }
  const held = session.shippingDetails;
  const want = expected.shipping;
  if (
    !held ||
    held.name.trim() !== want.name.trim() ||
    held.line1.trim() !== want.line1.trim() ||
    (held.line2?.trim() || null) !== (want.line2?.trim() || null) ||
    held.city.trim() !== want.city.trim() ||
    !samePostcode(held.postcode, want.postcode) ||
    held.country.toUpperCase() !== want.country
  ) {
    return "shipping_details";
  }
  return null;
}

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
 *     only rate and the shipping details. The update is keyed by the order and the session's bind
 *     revision, so a bind that returns to an earlier rate or address is a new request: Stripe
 *     replays a key's first response for 24 hours without applying the request again;
 *  4. the session is read back from Stripe, and its total, its one rate and its shipping details
 *     must be the order's. Otherwise the order is released, the session ended and the confirm
 *     refused, so the shopper can never pay a session that does not match its order.
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
    bindRevision: snapshot.bindRevision + 1,
    idempotencyKey: `checkout:shop-express-bind:${input.orderId}:r${snapshot.bindRevision}`,
  });
  // The update's response may be a replay, so the session is read back and checked as well.
  let mismatch: string | null = "update_amount_total";
  if (bound.amountTotalPence === input.totalPence) {
    const after = await gateway.readExpressCheckout({ sessionId: input.sessionId });
    if (after?.status === "complete" && after.orderId === input.orderId) {
      // Paid meanwhile for this order (another confirm): the webhook checks and settles it.
      return result;
    }
    mismatch = expressBindMismatch(after, {
      orderId: input.orderId,
      totalPence: input.totalPence,
      fulfilmentSurchargePence: input.fulfilmentSurchargePence,
      shipping: input.shipping,
    });
  }
  if (mismatch) {
    // Never let a session be paid for anything but its order.
    console.error(
      JSON.stringify({
        msg: SHOP_EXPRESS_BIND_MISMATCH,
        orderId: input.orderId,
        sessionId: input.sessionId,
        reason: mismatch,
      }),
    );
    try {
      await input.release();
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: SHOP_EXPRESS_BIND_MISMATCH,
          orderId: input.orderId,
          sessionId: input.sessionId,
          reason: "release_failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, EXPRESS_PAYMENT_NOT_READY_MESSAGE, 409);
  }
  return result;
}
