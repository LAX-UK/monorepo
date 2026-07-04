import type Stripe from "stripe";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import { chargeIdFromPaymentIntent } from "../stripe/stripe-charge-id.js";
import type { IPaymentIntentWebhookHandler } from "./payment-intent-webhook-handler.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";
import {
  PAYMENT_WEBHOOK_EVENT_SOURCE,
  type PaymentWebhookResult,
} from "./payment-webhook-types.js";

export class PaymentIntentSucceededHandler implements IPaymentIntentWebhookHandler {
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

    const expectedPence = gbpAmountToPence(paymentRow.amount);
    if (paymentIntent.amount !== expectedPence) {
      recordMoneyPathEvent("payment_intent_amount_mismatch");
      return { processed: false, action: "skipped", reason: "amount_mismatch" };
    }

    const chargeId = chargeIdFromPaymentIntent(paymentIntent);

    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(
        tx,
        event.id,
        PAYMENT_WEBHOOK_EVENT_SOURCE,
      );
      if (!claimed) {
        return { processed: false, action: "skipped", reason: "duplicate_event" };
      }

      if (paymentRow.status === "cancelled" || paymentRow.status === "refunded") {
        recordMoneyPathEvent("stripe_succeeded_for_terminal_payment");
        console.error(
          JSON.stringify({
            msg: "stripe_succeeded_for_terminal_payment",
            paymentId,
            lotId: paymentRow.lotId,
            statusBefore: paymentRow.status,
            stripePaymentIntentId: paymentIntent.id,
            stripeChargeId: chargeId,
          }),
        );
        await this.deps.domainEventSink.withTx(tx).publish({
          aggregateType: "payment",
          aggregateId: paymentId,
          eventType: "payment.capture_blocked_terminal_status",
          payload: {
            paymentId,
            lotId: paymentRow.lotId,
            buyerUserId: paymentRow.paidByUserId ?? paymentRow.buyerId ?? null,
            statusBefore: paymentRow.status,
            stripePaymentIntentId: paymentIntent.id,
            stripeChargeId: chargeId,
            amountCents: expectedPence,
          },
          actorUserId: null,
          actingLegalEntityId: paymentRow.buyerLegalEntityId ?? null,
        });
        return {
          processed: true,
          action: "payment_intent_succeeded_terminal_blocked",
          reason: "payment_terminal_status",
        };
      }

      await this.deps.paymentCapture.capture({
        paymentId,
        via: "stripe_checkout_webhook",
        stripeChargeId: chargeId,
        stripePaymentIntentId: paymentIntent.id,
        requireApply: true,
        tx,
      });

      return { processed: true, action: "payment_intent_succeeded" };
    });
  }
}
