import type Stripe from "stripe";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";
import {
  PAYMENT_WEBHOOK_EVENT_SOURCE,
  type PaymentWebhookResult,
} from "./payment-webhook-types.js";

/**
 * Stripe sends `cash_balance.funds_available` when a bank transfer is left in the buyer's balance
 * after it applied what it could to open payments: a transfer after the invoice was cancelled, a
 * second transfer, or more than was due. Finance decides what to do with it.
 */
export function handleCustomerBalanceFundsAvailable(
  deps: StripePaymentWebhookDeps,
  event: Stripe.Event,
  balance: Stripe.CashBalance,
): Promise<PaymentWebhookResult> {
  return deps.transactionRunner.runInTransaction(async (tx) => {
    const { claimed } = await tryClaimProcessedStripeEvent(
      tx,
      event.id,
      PAYMENT_WEBHOOK_EVENT_SOURCE,
    );
    if (!claimed) return { processed: false, action: "skipped", reason: "duplicate_event" };
    const available = Object.entries(balance.available ?? {}).filter(([, cents]) => cents > 0);
    for (const [currency, amountCents] of available) {
      await deps.unappliedMoney.record(
        tx,
        {
          reason: "customer_balance_unapplied",
          paymentId: null,
          paymentGroupId: null,
          stripePaymentIntentId: null,
          stripeChargeId: null,
          stripeCustomerId: balance.customer,
          amountCents,
          currency,
        },
        null,
      );
    }
    return available.length > 0
      ? { processed: true, action: "customer_balance_unapplied" }
      : { processed: true, action: "skipped", reason: "no_balance_left" };
  });
}
