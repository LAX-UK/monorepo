import type Stripe from "stripe";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { payoutRepoForTx } from "../payout/payout-helpers.js";
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

export async function handleChargeRefunded(
  deps: StripePaymentWebhookDeps,
  event: Stripe.Event,
  charge: Stripe.Charge,
): Promise<PaymentWebhookResult> {
  return deps.transactionRunner.runInTransaction(async (tx) => {
    const { claimed } = await tryClaimProcessedStripeEvent(
      tx,
      event.id,
      PAYMENT_WEBHOOK_EVENT_SOURCE,
    );
    if (!claimed) {
      return { processed: false, action: "skipped", reason: "duplicate_event" };
    }

    const paymentRow = await findPaymentRow(deps, {
      chargeId: charge.id,
      paymentIntentId:
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : (charge.payment_intent?.id ?? null),
      paymentId: charge.metadata?.paymentId ?? null,
    });
    if (!paymentRow) {
      return { processed: true, action: "skipped", reason: "no_matching_payment" };
    }
    // Only money captured for this invoice is clawed back from its seller. A refund of money on a
    // closed invoice (sent back by finance) or of another charge never reached the seller.
    const chargeIntent =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : (charge.payment_intent?.id ?? null);
    if (!isInvoiceMoney(paymentRow, { id: charge.id, paymentIntentId: chargeIntent })) {
      return { processed: true, action: "skipped", reason: "refund_of_money_not_applied" };
    }

    const payoutRepo = payoutRepoForTx(deps.payoutRepository, tx);
    const cumulativeRefundedCents = charge.amount_refunded ?? charge.amount ?? 0;
    const priorRefundedCents = await payoutRepo.sumRefundLineCentsForPayment(paymentRow.id);
    const deltaCents = cumulativeRefundedCents - priorRefundedCents;

    if (deltaCents <= 0) {
      return { processed: true, action: "skipped", reason: "no_new_refund_amount" };
    }

    const isFullRefund = cumulativeRefundedCents >= (charge.amount ?? cumulativeRefundedCents);
    if (isFullRefund) {
      await deps.payments.applyRefundedInTransaction(tx, paymentRow.id, null);
    }

    const negativeAmount = (-deltaCents / 100).toFixed(2);
    await deps.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
      legalEntityId: paymentRow.sellerLegalEntityId,
      paymentId: paymentRow.id,
      amount: negativeAmount,
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
        amountCents: deltaCents,
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
