import type Stripe from "stripe";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IPaymentIntentWebhookHandler } from "./payment-intent-webhook-handler.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";
import {
  PAYMENT_WEBHOOK_EVENT_SOURCE,
  type PaymentWebhookResult,
} from "./payment-webhook-types.js";

export class PaymentIntentFailedHandler implements IPaymentIntentWebhookHandler {
  constructor(private readonly deps: StripePaymentWebhookDeps) {}

  async handle(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    const paymentId = paymentIntent.metadata?.paymentId;
    if (!paymentId) {
      return { processed: true, action: "skipped", reason: "missing_payment_id_metadata" };
    }

    const paymentRow = await this.deps.payments.findById(paymentId);
    if (!paymentRow) {
      recordMoneyPathEvent("stripe_payment_webhook_payment_not_found");
      return { processed: false, action: "skipped", reason: "payment_not_found" };
    }

    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(
        tx,
        event.id,
        PAYMENT_WEBHOOK_EVENT_SOURCE,
      );
      if (!claimed) {
        return { processed: false, action: "skipped", reason: "duplicate_event" };
      }

      await this.deps.domainEventPublisher.publish(tx, {
        aggregateType: "payment",
        aggregateId: paymentId,
        eventType: "payment.checkout_failed",
        payload: {
          paymentId,
          lotId: paymentRow.lotId,
          buyerUserId: paymentRow.paidByUserId ?? paymentRow.buyerId ?? null,
          stripePaymentIntentId: paymentIntent.id,
          statusBefore: paymentRow.status,
        },
        actorUserId: null,
        actingLegalEntityId: paymentRow.buyerLegalEntityId ?? null,
      });

      recordMoneyPathEvent("payment_intent_failed");
      return { processed: true, action: "payment_intent_failed" };
    });
  }
}
