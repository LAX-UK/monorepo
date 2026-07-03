import type Stripe from "stripe";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { type StripePaymentWebhookDeps, findPaymentRow } from "./payment-webhook-lookup.js";
import {
  PAYMENT_WEBHOOK_EVENT_SOURCE,
  type PaymentWebhookResult,
} from "./payment-webhook-types.js";

export async function handleDisputeCreated(
  deps: StripePaymentWebhookDeps,
  event: Stripe.Event,
  dispute: Stripe.Dispute,
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

    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (!chargeId) {
      return { processed: false, reason: "missing_charge_id" };
    }

    const paymentRow = await findPaymentRow(deps, { chargeId });
    if (!paymentRow) {
      return { processed: true, action: "skipped", reason: "no_matching_payment" };
    }

    await deps.domainEventPublisher.publish(tx, {
      aggregateType: "payment",
      aggregateId: paymentRow.id,
      eventType: "payment.dispute_opened",
      payload: {
        stripeDisputeId: dispute.id,
        stripeChargeId: chargeId,
        amountCents: dispute.amount,
        currency: dispute.currency,
        reason: dispute.reason ?? null,
        sellerLegalEntityId: paymentRow.sellerLegalEntityId,
      },
      actorUserId: null,
      actingLegalEntityId: paymentRow.sellerLegalEntityId,
    });

    return { processed: true, action: "dispute_created" };
  });
}

export async function handleDisputeFundsWithdrawn(
  deps: StripePaymentWebhookDeps,
  event: Stripe.Event,
  dispute: Stripe.Dispute,
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

    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (!chargeId) {
      return { processed: false, reason: "missing_charge_id" };
    }

    const paymentRow = await findPaymentRow(deps, { chargeId });
    if (!paymentRow) {
      return { processed: true, action: "skipped", reason: "no_matching_payment" };
    }

    const negativeAmount = (-dispute.amount / 100).toFixed(2);
    await deps.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
      legalEntityId: paymentRow.sellerLegalEntityId,
      paymentId: paymentRow.id,
      amount: negativeAmount,
      kind: "dispute",
      sourceEventId: event.id,
      note: `Dispute funds withdrawn: ${dispute.id}`,
      tx,
    });

    await deps.domainEventPublisher.publish(tx, {
      aggregateType: "payment",
      aggregateId: paymentRow.id,
      eventType: "payment.dispute_funds_withdrawn",
      payload: {
        stripeDisputeId: dispute.id,
        stripeChargeId: chargeId,
        amountCents: dispute.amount,
        currency: dispute.currency,
        sellerLegalEntityId: paymentRow.sellerLegalEntityId,
      },
      actorUserId: null,
      actingLegalEntityId: paymentRow.sellerLegalEntityId,
    });

    return { processed: true, action: "dispute_funds_withdrawn" };
  });
}

export async function handleDisputeClosed(
  deps: StripePaymentWebhookDeps,
  event: Stripe.Event,
  dispute: Stripe.Dispute,
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

    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (!chargeId) {
      return { processed: false, reason: "missing_charge_id" };
    }

    const paymentRow = await findPaymentRow(deps, { chargeId });
    if (!paymentRow) {
      return { processed: true, action: "skipped", reason: "no_matching_payment" };
    }

    const outcome =
      dispute.status === "won" ? "won" : dispute.status === "lost" ? "lost" : "closed";

    if (dispute.status === "won") {
      const reversalAmount = (dispute.amount / 100).toFixed(2);
      await deps.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
        legalEntityId: paymentRow.sellerLegalEntityId,
        paymentId: paymentRow.id,
        amount: reversalAmount,
        kind: "dispute",
        sourceEventId: `${event.id}:won_reversal`,
        note: `Dispute won — reverse clawback: ${dispute.id}`,
        tx,
      });
    }

    await deps.domainEventPublisher.publish(tx, {
      aggregateType: "payment",
      aggregateId: paymentRow.id,
      eventType: "payment.dispute_closed",
      payload: {
        stripeDisputeId: dispute.id,
        stripeChargeId: chargeId,
        outcome,
        amountCents: dispute.amount,
        currency: dispute.currency,
        sellerLegalEntityId: paymentRow.sellerLegalEntityId,
      },
      actorUserId: null,
      actingLegalEntityId: paymentRow.sellerLegalEntityId,
    });

    return { processed: true, action: "dispute_closed" };
  });
}
