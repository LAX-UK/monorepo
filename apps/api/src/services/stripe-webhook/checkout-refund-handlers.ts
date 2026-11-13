import type { Database } from "@auction/db";
import type Stripe from "stripe";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import { payoutRepoForTx } from "../payout/payout-helpers.js";
import { chargeRefundTotals, refundCorrectionPence } from "../stripe/stripe-refund-status.js";
import { type StripePaymentWebhookDeps, findPaymentRow } from "./payment-webhook-lookup.js";
import {
  PAYMENT_WEBHOOK_EVENT_SOURCE,
  type PaymentWebhookResult,
} from "./payment-webhook-types.js";

/**
 * Whether the refunded charge is the money that paid this invoice: its recorded charge, or, when
 * no charge was recorded, its recorded payment intent. An invoice with neither (marked paid by
 * staff) owns no Stripe charge, so a Stripe refund is not its refund.
 */
function isInvoiceMoney(
  row: {
    stripeChargeId?: string | null;
    stripePaymentIntentId?: string | null;
    everCaptured?: boolean;
  },
  charge: { id: string; paymentIntentId: string | null },
): boolean {
  if (row.everCaptured === false) return false;
  if (row.stripeChargeId) return row.stripeChargeId === charge.id;
  if (row.stripePaymentIntentId) return row.stripePaymentIntentId === charge.paymentIntentId;
  return row.everCaptured === undefined;
}

/**
 * A refund on a single invoice's charge, from `charge.refunded`, `charge.refund.updated` or the
 * refund reconcile job: the invoice's record and its seller's ledger are brought to what Stripe
 * lists as succeeded on the charge. Pending refunds are not counted (they are watched until
 * final). A counted refund that Stripe later reports failed or cancelled is taken back by a
 * compensating entry, once. Every step is a delta measured under the payment's lock, so events
 * may arrive in any order or more than once and the job may run alongside them.
 */
export async function handleChargeRefunded(
  deps: StripePaymentWebhookDeps,
  event: Stripe.Event,
  charge: Stripe.Charge,
): Promise<PaymentWebhookResult> {
  if (!deps.chargeRefunds) {
    // Without Stripe's list nothing can be measured; failing makes Stripe deliver it again.
    throw new Error("Charge refunds are not wired");
  }
  // Read before the transaction, so no lock is held across the network call. What it is
  // measured against (what is already recorded) is read under the lock below.
  const totals = chargeRefundTotals(await deps.chargeRefunds.listChargeRefunds(charge.id));

  return deps.transactionRunner.runInTransaction(async (tx) => {
    const { claimed } = await tryClaimProcessedStripeEvent(
      tx,
      event.id,
      PAYMENT_WEBHOOK_EVENT_SOURCE,
    );
    if (!claimed) {
      return { processed: false, action: "skipped", reason: "duplicate_event" };
    }

    const chargeIntent =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : (charge.payment_intent?.id ?? null);
    const paymentRow = await findPaymentRow(deps, {
      chargeId: charge.id,
      paymentIntentId: chargeIntent,
      paymentId: charge.metadata?.paymentId ?? null,
    });
    if (!paymentRow) {
      return { processed: true, action: "skipped", reason: "no_matching_payment" };
    }
    // Only money captured for this invoice is clawed back from its seller. A refund of money on a
    // closed invoice (sent back by finance) or of another charge never reached the seller.
    if (!isInvoiceMoney(paymentRow, { id: charge.id, paymentIntentId: chargeIntent })) {
      return { processed: true, action: "skipped", reason: "refund_of_money_not_applied" };
    }

    // One refund of this payment at a time (a staff refund, another event): what is recorded can
    // only be summed correctly while the row is held, and the lookup above ran outside this
    // transaction. Nothing below is read before the lock.
    if (!(await deps.paymentRefunds.lockPaymentInTransaction(tx, paymentRow.id))) {
      return { processed: true, action: "skipped", reason: "no_matching_payment" };
    }

    const cumulativeRefundedCents = totals.countedPence;
    // The buyer's record and the seller's ledger are measured separately. A refund the previous
    // release processed has a payout line but no buyer row until the backfill is run again, and
    // the seller must not be charged back for it a second time.
    const { pence: recordedBuyerCents } = await deps.paymentRefunds.sumRefundedPenceInTransaction(
      tx,
      paymentRow.id,
    );
    const recordedSellerCents = await payoutRepoForTx(
      deps.payoutRepository,
      tx,
    ).sumRefundLineCentsForPayment(paymentRow.id);
    const buyerCorrection = refundCorrectionPence({
      recordedPence: recordedBuyerCents,
      countedPence: cumulativeRefundedCents,
      returnedNothingPence: totals.returnedNothingPence,
    });
    const sellerCorrection = refundCorrectionPence({
      recordedPence: recordedSellerCents,
      countedPence: cumulativeRefundedCents,
      returnedNothingPence: totals.returnedNothingPence,
    });

    if (buyerCorrection === 0 && sellerCorrection === 0) {
      return { processed: true, action: "skipped", reason: "no_new_refund_amount" };
    }
    if (buyerCorrection < 0 || sellerCorrection < 0) {
      return reverseFailedRefund(deps, tx, event, charge, paymentRow, {
        buyerCorrection,
        sellerCorrection,
        cumulativeRefundedCents,
      });
    }

    const isFullRefund = cumulativeRefundedCents >= (charge.amount ?? cumulativeRefundedCents);
    if (isFullRefund) {
      // False when staff refunded it first; the amounts above already account for that refund.
      await deps.payments.applyRefundedInTransaction(tx, paymentRow.id, null);
    }

    if (buyerCorrection > 0) {
      await deps.paymentRefunds.recordInTransaction(tx, {
        paymentId: paymentRow.id,
        idempotencyKey: event.id,
        amountPence: buyerCorrection,
        currency: charge.currency,
        source: "card_webhook",
      });
    }
    if (sellerCorrection <= 0) {
      // Only the buyer's record was behind: the seller was charged back when the previous release
      // handled this refund, and was announced then.
      return { processed: true, action: "skipped", reason: "refund_already_in_seller_ledger" };
    }

    await deps.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
      legalEntityId: paymentRow.sellerLegalEntityId,
      paymentId: paymentRow.id,
      amount: (-sellerCorrection / 100).toFixed(2),
      kind: "refund",
      sourceEventId: event.id,
      note: `Refund: ${charge.id}`,
      tx,
    });

    await deps.domainEventSink.withTx(tx).publish({
      aggregateType: "payment",
      aggregateId: paymentRow.id,
      eventType: "payment.refunded",
      payload: {
        stripeChargeId: charge.id,
        amountCents: sellerCorrection,
        cumulativeRefundedCents,
        currency: charge.currency,
        sellerLegalEntityId: paymentRow.sellerLegalEntityId,
        via: "stripe_webhook",
      },
      actorUserId: null,
      actingLegalEntityId: paymentRow.sellerLegalEntityId,
    });

    return { processed: true, action: "refund_received" };
  });
}

/**
 * The record holds a refund Stripe now reports failed or cancelled (counted by the previous
 * release while pending, or a succeeded refund Stripe reversed). The money stayed, so the
 * buyer's record gets a compensating row, the seller is given back what was clawed, the invoice
 * leaves "refunded" if it no longer is, and the reversal is announced. Each entry is keyed by the
 * event, and the amounts are deltas under the lock, so it happens once.
 */
async function reverseFailedRefund(
  deps: StripePaymentWebhookDeps,
  tx: Database,
  event: Stripe.Event,
  charge: Stripe.Charge,
  paymentRow: { id: string; sellerLegalEntityId: string },
  amounts: { buyerCorrection: number; sellerCorrection: number; cumulativeRefundedCents: number },
): Promise<PaymentWebhookResult> {
  const { buyerCorrection, sellerCorrection, cumulativeRefundedCents } = amounts;
  const key = `${event.id}:reversal`;
  recordMoneyPathEvent("refund_reversed_after_failure");
  if (cumulativeRefundedCents < (charge.amount ?? 0)) {
    await deps.payments.applyRefundReversedInTransaction(tx, paymentRow.id);
  }
  if (buyerCorrection < 0) {
    await deps.paymentRefunds.recordInTransaction(tx, {
      paymentId: paymentRow.id,
      idempotencyKey: key,
      amountPence: buyerCorrection,
      currency: charge.currency,
      source: "refund_reversal",
    });
  }
  if (sellerCorrection < 0) {
    await deps.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
      legalEntityId: paymentRow.sellerLegalEntityId,
      paymentId: paymentRow.id,
      amount: (-sellerCorrection / 100).toFixed(2),
      kind: "refund",
      sourceEventId: key,
      note: `Refund failed: ${charge.id}`,
      tx,
    });
  }
  await deps.domainEventSink.withTx(tx).publish({
    aggregateType: "payment",
    aggregateId: paymentRow.id,
    eventType: "payment.refund_reversed",
    payload: {
      stripeChargeId: charge.id,
      amountCents: -Math.min(buyerCorrection, sellerCorrection),
      cumulativeRefundedCents,
      currency: charge.currency,
      sellerLegalEntityId: paymentRow.sellerLegalEntityId,
      via: "stripe_webhook",
    },
    actorUserId: null,
    actingLegalEntityId: paymentRow.sellerLegalEntityId,
  });
  return { processed: true, action: "refund_reversed" };
}
