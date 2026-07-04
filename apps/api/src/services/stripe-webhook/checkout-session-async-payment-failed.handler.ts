import type Stripe from "stripe";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { ICheckoutSessionWebhookHandler } from "./checkout-session-webhook-handler.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";
import {
  PAYMENT_WEBHOOK_EVENT_SOURCE,
  type PaymentWebhookResult,
} from "./payment-webhook-types.js";

export class CheckoutSessionAsyncPaymentFailedHandler implements ICheckoutSessionWebhookHandler {
  constructor(private readonly deps: StripePaymentWebhookDeps) {}

  async handle(
    event: Stripe.Event,
    session: Stripe.Checkout.Session,
  ): Promise<PaymentWebhookResult> {
    const paymentId = session.metadata?.paymentId;
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

      const cancelled = await this.deps.payments.applyCancelledInTransaction(tx, paymentId);
      if (cancelled) {
        await this.deps.domainEventSink.withTx(tx).publish({
          aggregateType: "payment",
          aggregateId: paymentId,
          eventType: "payment.cancelled",
          payload: {
            lotId: paymentRow.lotId,
            buyerUserId: paymentRow.paidByUserId ?? paymentRow.buyerId ?? null,
            reason: "stripe_checkout_async_payment_failed",
          },
          actorUserId: null,
          actingLegalEntityId: paymentRow.buyerLegalEntityId ?? null,
        });
      }

      recordMoneyPathEvent("checkout_session_async_payment_failed");
      return { processed: true, action: "checkout_session_async_payment_failed" };
    });
  }
}
