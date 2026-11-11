import { fundingThatSuppliedApplication, isTransferAppliedToOtherPayment } from "@auction/domain";
import type { IPaymentTransferReferenceStore } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { ICashBalanceGateway } from "../stripe/cash-balance-gateway.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";
import {
  PAYMENT_WEBHOOK_EVENT_SOURCE,
  type PaymentWebhookResult,
} from "./payment-webhook-types.js";

/** What the transfer check reads: the provider's ledger and the references kept here. */
export type TransferCheckDeps = {
  cashBalance: ICashBalanceGateway;
  references: IPaymentTransferReferenceStore;
};

const idOf = (value: string | { id: string }): string =>
  typeof value === "string" ? value : value.id;

/**
 * The reference the receiving payment told its sender to quote: the one the provider still shows,
 * else the one kept when it was first shown. When both exist and differ the live one is used and
 * the disagreement is counted (it should never happen).
 */
async function ownReferenceOf(
  references: IPaymentTransferReferenceStore,
  intentId: string,
  live: string | null,
): Promise<string | null> {
  const stored = (await references.findByPaymentIntent(intentId))?.reference ?? null;
  if (live && stored && live.trim().toUpperCase() !== stored.trim().toUpperCase()) {
    recordMoneyPathEvent("transfer_reference_stored_differs_from_live");
  }
  return live ?? stored;
}

/**
 * Stripe sends `customer_cash_balance_transaction.created` for every movement of a buyer's
 * transfer balance. When money is applied to a payment (`applied_to_payment`), the transfer that
 * supplied it is found in the buyer's recent ledger. If that transfer quoted a reference other
 * than the payment's own, Stripe's automatic reconciliation put it on a different invoice than the
 * sender meant: finance gets a task naming both invoices, and the money stays where Stripe applied
 * it.
 *
 * Idempotent: the event is claimed once, and the task is keyed by the ledger entry. Bounded: one
 * ledger page and one payment read, only for applications.
 */
export async function handleCashBalanceTransactionCreated(
  deps: StripePaymentWebhookDeps,
  checks: TransferCheckDeps,
  event: Stripe.Event,
  txn: Stripe.CustomerCashBalanceTransaction,
): Promise<PaymentWebhookResult> {
  if (txn.type !== "applied_to_payment" || !txn.applied_to_payment) {
    return { processed: true, action: "skipped", reason: "not_an_application" };
  }
  const { cashBalance, references } = checks;
  const intentId = idOf(txn.applied_to_payment.payment_intent);
  const customerId = idOf(txn.customer);

  const payment = await cashBalance.describePayment(intentId);
  // Late notice of a reference the events did not carry: kept while it can still be read.
  if (payment.ownReference) {
    await references.remember({
      stripePaymentIntentId: intentId,
      reference: payment.ownReference,
      paymentId: payment.paymentId,
      paymentGroupId: payment.paymentGroupId,
    });
  }
  const ownReference = await ownReferenceOf(references, intentId, payment.ownReference);
  if (!ownReference) {
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
      paymentOwnReference: ownReference,
    })
  ) {
    return { processed: true, action: "skipped", reason: "reference_matches_or_unknown" };
  }
  const intended = sentWith ? await references.findByReference(sentWith) : null;

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
        intendedPaymentId: intended?.paymentId ?? null,
        intendedPaymentGroupId: intended?.paymentGroupId ?? null,
        amountCents: Math.abs(txn.net_amount),
        currency: txn.currency,
      },
      null,
    );
    recordMoneyPathEvent("transfer_applied_to_other_invoice");
    return { processed: true, action: "transfer_applied_to_other_invoice" };
  });
}
