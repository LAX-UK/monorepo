import { fundingThatSuppliedApplication, isTransferAppliedToOtherPayment } from "@auction/domain";
import type Stripe from "stripe";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { ICashBalanceGateway } from "../stripe/cash-balance-gateway.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";
import {
  PAYMENT_WEBHOOK_EVENT_SOURCE,
  type PaymentWebhookResult,
} from "./payment-webhook-types.js";

const idOf = (value: string | { id: string }): string =>
  typeof value === "string" ? value : value.id;

/**
 * Stripe sends `customer_cash_balance_transaction.created` for every movement of a buyer's
 * transfer balance. When money is applied to a payment (`applied_to_payment`), the transfer that
 * supplied it is found in the buyer's recent ledger. If that transfer quoted a reference other
 * than the payment's own, Stripe's automatic reconciliation put it on a different invoice than the
 * sender meant: finance gets a task, the money stays where Stripe applied it.
 *
 * Idempotent: the event is claimed once, and the task is keyed by the ledger entry. Bounded: one
 * ledger page and one payment read, only for applications.
 */
export async function handleCashBalanceTransactionCreated(
  deps: StripePaymentWebhookDeps,
  cashBalance: ICashBalanceGateway,
  event: Stripe.Event,
  txn: Stripe.CustomerCashBalanceTransaction,
): Promise<PaymentWebhookResult> {
  if (txn.type !== "applied_to_payment" || !txn.applied_to_payment) {
    return { processed: true, action: "skipped", reason: "not_an_application" };
  }
  const intentId = idOf(txn.applied_to_payment.payment_intent);
  const customerId = idOf(txn.customer);

  const payment = await cashBalance.describePayment(intentId);
  if (!payment.ownReference) {
    recordMoneyPathEvent("transfer_application_check_skipped_no_reference");
    return { processed: true, action: "skipped", reason: "payment_reference_unavailable" };
  }
  const funding = fundingThatSuppliedApplication(
    await cashBalance.listRecentFundings(customerId),
    txn.created,
  );
  const sentWith = funding?.reference ?? null;
  if (
    !isTransferAppliedToOtherPayment({
      sentWithReference: sentWith,
      paymentOwnReference: payment.ownReference,
    })
  ) {
    return { processed: true, action: "skipped", reason: "reference_matches_or_unknown" };
  }

  return deps.transactionRunner.runInTransaction(async (tx) => {
    const { claimed } = await tryClaimProcessedStripeEvent(
      tx,
      event.id,
      PAYMENT_WEBHOOK_EVENT_SOURCE,
    );
    if (!claimed) return { processed: false, action: "skipped", reason: "duplicate_event" };
    await deps.unappliedMoney.record(
      tx,
      {
        reason: "transfer_applied_to_other_invoice",
        paymentId: payment.paymentId,
        paymentGroupId: payment.paymentGroupId,
        stripePaymentIntentId: intentId,
        stripeChargeId: null,
        stripeCustomerId: customerId,
        cashBalanceTransactionId: txn.id,
        transferReference: sentWith,
        amountCents: Math.abs(txn.net_amount),
        currency: txn.currency,
      },
      null,
    );
    recordMoneyPathEvent("transfer_applied_to_other_invoice");
    return { processed: true, action: "transfer_applied_to_other_invoice" };
  });
}
