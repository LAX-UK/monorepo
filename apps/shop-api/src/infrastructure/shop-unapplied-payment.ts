import type { Database } from "@auction/db";
import {
  UNAPPLIED_MONEY_EVENT,
  type UnappliedMoney,
  type UnappliedMoneyReason,
  unappliedMoneyAggregate,
  unappliedMoneyPayload,
} from "@auction/domain";
import type { IUnappliedMoneyReader } from "@auction/persistence/interfaces";
import type { UnappliedPaymentFailure } from "../errors/shop-payment-webhook.error.js";
import type { createShopDomainEventPublisher } from "./shop-domain-event-publisher.js";

/** What the Shop needs of the finance task store: serialise one piece of money, and see if it is known. */
export type UnappliedMoneyLookup = Pick<IUnappliedMoneyReader, "lockKey" | "existsForShopPayment">;

/** Why a Shop payment could not be applied to its order. */
export type ShopUnappliedReason = Extract<UnappliedMoneyReason, `shop_order_${string}`>;

/**
 * The failures of applying a payment that Stripe cannot cure by sending it again, each with the
 * finance task it opens. Anything else (a database error, a refund that did not persist) is not in
 * here: it stays an error and the webhook answers as before.
 */
export const SHOP_PAYMENT_FAILURE_REASONS = {
  amount_mismatch: "shop_order_amount_mismatch",
  session_mismatch: "shop_order_session_mismatch",
  edition_state_invalid: "shop_order_edition_state_invalid",
  paid_twice: "shop_order_paid_twice",
  paid_after_close: "shop_order_paid_after_close",
  paid_while_money_paused: "shop_order_paid_while_paused",
} as const satisfies Record<UnappliedPaymentFailure, ShopUnappliedReason>;

/**
 * The failures that arrive on the order's own payment session while it still waits for payment.
 * That session is now spent, so nothing can ever pay the order: it is closed, its prints released
 * and its basket restored, and the money is finance's task. A payment in some other session
 * leaves the order waiting, because its own session can still be paid.
 */
const FAILURES_THAT_CLOSE_THE_ORDER: ReadonlySet<UnappliedPaymentFailure> = new Set([
  "amount_mismatch",
  "edition_state_invalid",
  "paid_while_money_paused",
]);

export function closesOrder(failure: UnappliedPaymentFailure): boolean {
  return FAILURES_THAT_CLOSE_THE_ORDER.has(failure);
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
 * One task per payment: the same PaymentIntent or Checkout Session reported again, by a replayed
 * event, a second event or the checkout sweep, and for whatever reason, finds its task under one
 * lock and opens nothing new. The event sits on the same audit trail as the one that closes it.
 */
export async function recordUnappliedShopPayment(
  tx: Database,
  events: ReturnType<typeof createShopDomainEventPublisher>,
  unappliedMoney: UnappliedMoneyLookup,
  input: {
    reason: ShopUnappliedReason;
    /** The order the money was paid for; null when no such order exists here. */
    order: { id: string; reference: string | null; status: string } | null;
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
    // Without an intent the task is keyed by the session, then by the Stripe event.
    stripeEventId: input.eventId,
    shopOrderId: input.order?.id ?? null,
    shopOrderReference: input.order?.reference ?? null,
    shopCheckoutSessionId: input.sessionId,
    amountCents: input.amountPence,
    currency: "GBP",
  };
  const payload = unappliedMoneyPayload(money);
  // Keyed by the session, which every way of finding this payment (the webhook, the sweep) knows,
  // and checked across reasons: the same money found a second way opens no second task.
  await unappliedMoney.lockKey(tx, `shop-session:${input.sessionId}`);
  if (
    await unappliedMoney.existsForShopPayment(
      { paymentIntentId: input.paymentIntentId, sessionId: input.sessionId },
      tx,
    )
  ) {
    return;
  }
  console.error(
    JSON.stringify({
      msg:
        input.reason === "shop_order_paid_after_close"
          ? SHOP_PAID_TERMINAL_ORDER
          : SHOP_UNAPPLIED_PAYMENT,
      reason: input.reason,
      orderId: input.order?.id ?? null,
      orderStatus: input.order?.status ?? null,
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
