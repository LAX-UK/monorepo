import {
  isSameInvoiceMoney,
  isTransferAppliedToOtherPayment,
  referenceIssuedIn,
  senderQuotedReference,
} from "@auction/domain";
import type {
  IPaymentGroupRepository,
  IPaymentTransferReferenceStore,
  IPrivateSaleDealReader,
  TransferReferenceRecord,
} from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { ICashBalanceGateway } from "../stripe/cash-balance-gateway.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";
import {
  PAYMENT_WEBHOOK_EVENT_SOURCE,
  type PaymentWebhookResult,
} from "./payment-webhook-types.js";
import { rememberTransferDetails } from "./transfer-reference.js";

/** What the transfer check reads: the provider's ledger and the references kept here. */
export type TransferCheckDeps = {
  cashBalance: ICashBalanceGateway;
  references: IPaymentTransferReferenceStore;
  /** For telling an invoice from the combined payment that holds it. */
  groups: Pick<IPaymentGroupRepository, "listMembers"> | null;
  /** For naming a private sale deal the money was applied to. */
  deals: Pick<IPrivateSaleDealReader, "findById"> | null;
};

/** How many of a buyer's kept references a quoted reference is looked for among. */
const ISSUED_REFERENCES_WINDOW = 50;
/**
 * A reference event can arrive after the application it explains. For this long after an event,
 * a payment with no reference yet is answered with a retry; after it, the check is given up.
 */
const REFERENCE_EVENT_GRACE_SECONDS = 600;

const idOf = (value: string | { id: string }): string =>
  typeof value === "string" ? value : value.id;

const skipped = (reason: string, metric?: string): PaymentWebhookResult => {
  if (metric) recordMoneyPathEvent(metric);
  return { processed: true, action: "skipped", reason };
};

/**
 * Stripe sends `customer_cash_balance_transaction.created` for every movement of a buyer's
 * transfer balance. For money applied to a payment (`applied_to_payment`) the source is found by
 * walking the buyer's ledger back from that entry to the first transfer received
 * (`funded`, with the reference the sender quoted) or the first payment the money was taken back
 * from (`unapplied_from_payment`). When that is another invoice's reference, Stripe's automatic
 * reconciliation put the money on a different invoice than the sender meant: finance gets a task
 * naming both invoices, and the money stays where Stripe applied it.
 *
 * Idempotent: the event is claimed once, and the task is keyed by the ledger entry. Bounded: one
 * payment read and at most a few ledger pages, only for applications.
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
  try {
    await rememberTransferDetails(references, intentId, payment);
  } catch (cause) {
    deps.errorReporter?.report({
      message: "Could not keep a bank-transfer payment's reference",
      status: 500,
      code: "transfer_reference_not_kept",
      severity: "warn",
      cause,
    });
  }
  const stored = await references.findByPaymentIntent(intentId);
  if (
    payment.ownReference &&
    stored &&
    !senderQuotedReference(payment.ownReference, stored.reference)
  ) {
    recordMoneyPathEvent("transfer_reference_stored_differs_from_live");
  }
  const ownReference = payment.ownReference ?? stored?.reference ?? null;
  if (!ownReference) {
    recordMoneyPathEvent("transfer_application_check_skipped_no_reference");
    const ageSeconds = Date.now() / 1000 - (event.created ?? 0);
    // The event that carries the reference may simply not have been processed yet: ask for a
    // redelivery for a short while, then give the check up.
    return event.created && ageSeconds < REFERENCE_EVENT_GRACE_SECONDS
      ? { processed: false, action: "skipped", reason: "payment_reference_pending" }
      : { processed: true, action: "skipped", reason: "payment_reference_unavailable" };
  }

  const { supply, windowExceeded } = await cashBalance.findSupplyBehind(customerId, txn.id);
  if (!supply) {
    return skipped(
      "supply_not_found",
      windowExceeded ? "transfer_supply_window_exceeded" : "transfer_supply_not_found",
    );
  }

  let intended: TransferReferenceRecord | null;
  if (supply.kind === "funded") {
    const sent = supply.reference;
    if (!sent?.trim()) return skipped("no_reference_quoted");
    if (
      !isTransferAppliedToOtherPayment({
        sentWithReference: sent,
        paymentOwnReference: ownReference,
      })
    ) {
      return skipped("reference_matches");
    }
    const issued = await references.listForCustomer(customerId, ISSUED_REFERENCES_WINDOW);
    intended = referenceIssuedIn(
      sent,
      issued.filter((record) => record.stripePaymentIntentId !== intentId),
    );
    // Text that is none of our references (a name, an invoice number from elsewhere) does not
    // say the money was meant for another of our invoices.
    if (!intended) return skipped("reference_not_issued_here", "transfer_reference_not_ours");
  } else {
    if (supply.paymentIntentId === intentId) return skipped("moved_to_same_payment");
    intended = await references.findByPaymentIntent(supply.paymentIntentId);
  }

  if (intended) {
    const groupIds = [payment.paymentGroupId, intended.paymentGroupId].filter(
      (id): id is string => id !== null,
    );
    const members = new Map<string, string[]>();
    for (const groupId of new Set(groupIds)) {
      const listed = (await checks.groups?.listMembers(groupId)) ?? [];
      members.set(
        groupId,
        listed.map((member) => member.paymentId),
      );
    }
    if (isSameInvoiceMoney(payment, intended, (groupId) => members.get(groupId) ?? [])) {
      return skipped("same_invoice", "transfer_applied_to_same_invoice");
    }
  }
  const deal =
    payment.privateSaleDealId && checks.deals
      ? await checks.deals.findById(payment.privateSaleDealId)
      : null;

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
        // Only a reference we issued is kept, never what the sender typed around it.
        transferReference: intended?.reference ?? null,
        intendedPaymentId: intended?.paymentId ?? null,
        intendedPaymentGroupId: intended?.paymentGroupId ?? null,
        privateSaleDealId: payment.privateSaleDealId,
        privateSaleDealPaymentId: payment.privateSaleDealPaymentId,
        privateSaleDealReference: deal?.reference ?? null,
        amountCents: Math.abs(txn.net_amount),
        currency: txn.currency,
      },
      null,
    );
    recordMoneyPathEvent("transfer_applied_to_other_invoice");
    return { processed: true, action: "transfer_applied_to_other_invoice" };
  });
}
