import type { UnappliedPaymentFailure } from "../errors/shop-payment-webhook.error.js";

/** What a paid event is judged against: the order as it stands, locked. */
export type OrderForPayment = {
  status: string;
  totalPence: number;
  stripeCheckoutSessionId: string | null;
};

/** What a paid event is judged by. */
export type PaymentForOrder = { sessionId: string; amountTotalPence: number };

export type ShopPaymentVerdict =
  | { kind: "apply" }
  /** The same payment session again (another event for one payment): nothing new to do. */
  | { kind: "already_applied" }
  | { kind: "unapplied"; failure: UnappliedPaymentFailure };

/** Statuses an order reaches only through a payment of its own session. */
const REACHED_THROUGH_PAYMENT: ReadonlySet<string> = new Set([
  "paid",
  "refunded",
  "partially_refunded",
]);

/**
 * Whether the payment was made in the session the order was opened with. An order still waiting
 * for payment may have no session yet; an order reached through payment must name the session
 * that paid it, exactly, or a payment in any other session is a second one.
 */
export function isOrdersOwnSession(order: OrderForPayment, sessionId: string): boolean {
  if (order.status === "pending_payment" && !order.stripeCheckoutSessionId) return true;
  return order.stripeCheckoutSessionId === sessionId;
}

/**
 * The one decision on a paid event, in the order that matters. It is used to apply the payment
 * and again, on the freshly read order, to word the finance task, so the two can never disagree:
 *
 *  1. An order reached through payment: the same session is already done, another session is a
 *     second payment (only for an order still paid; a refunded one is money for a closed order).
 *  2. Any other closed order: money for an order that was released.
 *  3. A pending order: the session is checked before the amount, so a stale session is labelled
 *     as such rather than as a wrong amount.
 */
export function judgePayment(order: OrderForPayment, payment: PaymentForOrder): ShopPaymentVerdict {
  if (REACHED_THROUGH_PAYMENT.has(order.status) && isOrdersOwnSession(order, payment.sessionId)) {
    return { kind: "already_applied" };
  }
  if (order.status === "paid") return { kind: "unapplied", failure: "paid_twice" };
  if (order.status !== "pending_payment") return { kind: "unapplied", failure: "paid_after_close" };
  if (!isOrdersOwnSession(order, payment.sessionId)) {
    return { kind: "unapplied", failure: "session_mismatch" };
  }
  if (order.totalPence !== payment.amountTotalPence) {
    return { kind: "unapplied", failure: "amount_mismatch" };
  }
  return { kind: "apply" };
}
