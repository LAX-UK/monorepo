import type { Database } from "@auction/db";
import {
  UNAPPLIED_MONEY_EVENT,
  type UnappliedMoney,
  unappliedMoneyAggregate,
  unappliedMoneyPayload,
} from "@auction/domain";
import type { IUnappliedMoneyReader } from "@auction/persistence/interfaces";
import type { createShopDomainEventPublisher } from "./shop-domain-event-publisher.js";

/** What the Shop needs of the finance task store: serialise one piece of money, and see if it is known. */
export type UnappliedMoneyLookup = Pick<IUnappliedMoneyReader, "lockKey" | "exists">;

/** The name this event goes by in logs and alerts: money taken for an order that was closed. */
export const SHOP_PAID_TERMINAL_ORDER = "shop_paid_terminal_order";

/**
 * Money reached us for a Shop order that is no longer waiting for payment, so its prints are no
 * longer held for the buyer. It is never refunded automatically. Two records are made in the
 * webhook's own transaction, and neither depends on an email address being configured:
 *
 *  - a finance task (`payment.unapplied_money_received`, reason `shop_order_paid_after_close`)
 *    carrying the order, the Checkout Session, the PaymentIntent and the amount, which finance
 *    reads in its work inbox and is alerted to;
 *  - a structured `shop_paid_terminal_order` log line, for the money-path dashboards.
 *
 * One task per piece of money: the same PaymentIntent reported again, by a replayed event or a
 * second event for the same payment, finds its task under the same lock the finance recorder
 * takes and opens nothing new. The event sits on the same audit trail as the one that closes it.
 */
export async function recordPaidOnClosedOrder(
  tx: Database,
  events: ReturnType<typeof createShopDomainEventPublisher>,
  unappliedMoney: UnappliedMoneyLookup,
  input: {
    order: { id: string; reference: string | null; status: string };
    sessionId: string;
    paymentIntentId: string | null;
    amountPence: number;
    eventId: string;
  },
): Promise<void> {
  const money: UnappliedMoney = {
    reason: "shop_order_paid_after_close",
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
      msg: SHOP_PAID_TERMINAL_ORDER,
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
