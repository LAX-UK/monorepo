import type { Database } from "@auction/db";
import {
  UNAPPLIED_MONEY_EVENT,
  type UnappliedMoney,
  type UnappliedMoneyReason,
  unappliedMoneyAggregate,
  unappliedMoneyPayload,
} from "@auction/domain";
import type { IUnappliedMoneyReader } from "@auction/persistence/interfaces";
import type { createShopDomainEventPublisher } from "./shop-domain-event-publisher.js";

/** What the Shop needs of the finance task store: serialise one piece of money, and see if it is known. */
export type UnappliedMoneyLookup = Pick<IUnappliedMoneyReader, "lockKey" | "exists">;

/** Why a Shop payment could not be applied to its order. */
export type ShopUnappliedReason = Extract<UnappliedMoneyReason, `shop_order_${string}`>;

/**
 * The failures of applying a payment that Stripe cannot cure by sending it again, each with the
 * finance task it opens. Anything else (an order that does not exist, a database error) is not in
 * here: it stays an error and the webhook answers as before.
 */
export const SHOP_PAYMENT_FAILURE_REASONS = {
  /** What was paid is not the order's total. */
  amount_mismatch: "shop_order_amount_mismatch",
  /** Paid in a payment session that is not the one the order was opened with. */
  session_mismatch: "shop_order_session_mismatch",
  /** The print held for the order was no longer reserved for it when the payment arrived. */
  edition_state_invalid: "shop_order_edition_state_invalid",
  /** The order was already paid, in another payment session. */
  paid_twice: "shop_order_paid_twice",
} as const satisfies Record<string, ShopUnappliedReason>;

export type ShopPaymentFailure = keyof typeof SHOP_PAYMENT_FAILURE_REASONS;

export function isShopPaymentFailure(code: string): code is ShopPaymentFailure {
  return Object.hasOwn(SHOP_PAYMENT_FAILURE_REASONS, code);
}

/** The name this event goes by in logs and alerts: money taken for an order that was closed. */
export const SHOP_PAID_TERMINAL_ORDER = "shop_paid_terminal_order";
/** The name for money that could not be applied to an order that was still open or already paid. */
export const SHOP_UNAPPLIED_PAYMENT = "shop_unapplied_payment";

/**
 * Money reached us for a Shop order that it could not be applied to: the order was closed, the
 * amount or the payment session was not the order's, the print was no longer held for it, or the
 * order had already been paid. It is never refunded automatically and nothing about the order or
 * its stock is changed. Two records are made, and neither depends on an email address being
 * configured:
 *
 *  - a finance task (`payment.unapplied_money_received`, with the reason) carrying the order, the
 *    Checkout Session, the PaymentIntent and the amount actually paid, which finance reads in its
 *    work inbox and is alerted to;
 *  - a structured log line, for the money-path dashboards.
 *
 * One task per piece of money: the same PaymentIntent reported again, by a replayed event or a
 * second event for the same payment, finds its task under the same lock the finance recorder
 * takes and opens nothing new. The event sits on the same audit trail as the one that closes it.
 */
export async function recordUnappliedShopPayment(
  tx: Database,
  events: ReturnType<typeof createShopDomainEventPublisher>,
  unappliedMoney: UnappliedMoneyLookup,
  input: {
    reason: ShopUnappliedReason;
    order: { id: string; reference: string | null; status: string };
    sessionId: string;
    paymentIntentId: string | null;
    /** What was actually paid, which is what finance must return or apply. */
    amountPence: number;
    eventId: string;
  },
): Promise<void> {
  const money: UnappliedMoney = {
    reason: input.reason,
    paymentId: null,
    paymentGroupId: null,
    stripePaymentIntentId: input.paymentIntentId,
    stripeChargeId: null,
    stripeCustomerId: null,
    // Without an intent the task is still keyed, by the Stripe event that reported the money.
    stripeEventId: input.eventId,
    shopOrderId: input.order.id,
    shopOrderReference: input.order.reference,
    shopCheckoutSessionId: input.sessionId,
    amountCents: input.amountPence,
    currency: "GBP",
  };
  const payload = unappliedMoneyPayload(money);
  await unappliedMoney.lockKey(tx, payload.dedupeKey);
  if (await unappliedMoney.exists(payload.dedupeKey, tx)) return;
  console.error(
    JSON.stringify({
      msg:
        input.reason === "shop_order_paid_after_close"
          ? SHOP_PAID_TERMINAL_ORDER
          : SHOP_UNAPPLIED_PAYMENT,
      reason: input.reason,
      orderId: input.order.id,
      orderStatus: input.order.status,
      sessionId: input.sessionId,
      paymentIntentId: input.paymentIntentId,
      amountPence: input.amountPence,
    }),
  );
  await events.insertInTransaction(tx, {
    ...unappliedMoneyAggregate(money, payload.dedupeKey),
    eventType: UNAPPLIED_MONEY_EVENT,
    payload: { ...payload, schemaVersion: 1 },
    producer: "shop-api",
  });
}
