import type Stripe from "stripe";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { DrizzlePayoutRepository } from "../../repositories/drizzle-payout.repository.js";
import { type StripePaymentWebhookDeps, findPaymentRow } from "./payment-webhook-lookup.js";
import {
  PAYMENT_WEBHOOK_EVENT_SOURCE,
  type PaymentWebhookResult,
} from "./payment-webhook-types.js";

export async function handleChargeRefunded(
  deps: StripePaymentWebhookDeps,
  event: Stripe.Event,
  charge: Stripe.Charge,
): Promise<PaymentWebhookResult> {
  return deps.db.transaction(async (tx) => {
    const { claimed } = await tryClaimProcessedStripeEvent(
      tx,
      event.id,
      PAYMENT_WEBHOOK_EVENT_SOURCE,
    );
    if (!claimed) {
      return { processed: false, action: "skipped", reason: "duplicate_event" };
    }

    const paymentRow = await findPaymentRow(deps, tx, {
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

    const payoutRepo = tx === deps.db ? deps.payoutRepository : new DrizzlePayoutRepository(tx);
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

    await deps.domainEventPublisher.publish(tx, {
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
