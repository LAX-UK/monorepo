import type { IPaymentGroupRepository } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";
import {
  PAYMENT_WEBHOOK_EVENT_SOURCE,
  type PaymentWebhookResult,
} from "./payment-webhook-types.js";

/** How far back a bank-transfer payment still explains money left in the buyer's balance. */
export const OVERPAYMENT_LOOKBACK_MS = 30 * 86_400_000;

/**
 * Stripe sends `cash_balance.funds_available` when a bank transfer is left in the buyer's balance
 * after it applied what it could to open payments: a transfer after the invoice was cancelled, a
 * second transfer, or more than was due. Finance decides what to do with it, never an automatic
 * refund.
 *
 * Money left over by a transfer for a combined ("Pay several") payment is the way an overpayment
 * of one reaches us: Stripe applies the payment's amount and keeps the rest in the balance. When
 * the buyer's account has such a payment in the last 30 days, the money is raised as
 * `group_overpaid` against it so finance sees which payment it belongs to; otherwise it is the
 * general unapplied balance.
 */
export async function handleCustomerBalanceFundsAvailable(
  deps: StripePaymentWebhookDeps,
  event: Stripe.Event,
  balance: Stripe.CashBalance,
  groups: Pick<IPaymentGroupRepository, "findLatestBankTransferGroupForCustomer"> | null = null,
): Promise<PaymentWebhookResult> {
  const group =
    groups && typeof balance.customer === "string"
      ? await groups.findLatestBankTransferGroupForCustomer(
          balance.customer,
          new Date(Date.now() - OVERPAYMENT_LOOKBACK_MS),
        )
      : null;
  return deps.transactionRunner.runInTransaction(async (tx) => {
    const { claimed } = await tryClaimProcessedStripeEvent(
      tx,
      event.id,
      PAYMENT_WEBHOOK_EVENT_SOURCE,
    );
    if (!claimed) return { processed: false, action: "skipped", reason: "duplicate_event" };
    const available = Object.entries(balance.available ?? {}).filter(([, cents]) => cents > 0);
    for (const [currency, amountCents] of available) {
      const ofGroup = group !== null && group.currency.toLowerCase() === currency.toLowerCase();
      await deps.unappliedMoney.record(
        tx,
        {
          reason: ofGroup ? "group_overpaid" : "customer_balance_unapplied",
          paymentId: null,
          paymentGroupId: ofGroup ? group.id : null,
          stripePaymentIntentId: null,
          stripeChargeId: null,
          stripeCustomerId: balance.customer,
          stripeEventId: `${event.id}:${currency}`,
          amountCents,
          currency,
        },
        ofGroup ? group.buyerLegalEntityId : null,
      );
    }
    return available.length > 0
      ? { processed: true, action: "customer_balance_unapplied" }
      : { processed: true, action: "skipped", reason: "no_balance_left" };
  });
}
