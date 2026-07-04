import type Stripe from "stripe";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IPaymentIntentWebhookHandler } from "./payment-intent-webhook-handler.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";
import {
  PAYMENT_WEBHOOK_EVENT_SOURCE,
  type PaymentWebhookResult,
} from "./payment-webhook-types.js";

export class PaymentIntentPartiallyFundedHandler implements IPaymentIntentWebhookHandler {
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

    const amountRemainingCents =
      paymentIntent.next_action?.display_bank_transfer_instructions?.amount_remaining ??
      Math.max(0, paymentIntent.amount - (paymentIntent.amount_received ?? 0));

    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(
        tx,
        event.id,
        PAYMENT_WEBHOOK_EVENT_SOURCE,
      );
      if (!claimed) {
        return { processed: false, action: "skipped", reason: "duplicate_event" };
      }

      await this.deps.payments.applyAuthorizedInTransaction(tx, paymentId);

      await this.deps.domainEventSink.withTx(tx).publish({
        aggregateType: "payment",
        aggregateId: paymentId,
        eventType: "payment.bank_transfer_partially_funded",
        payload: {
          paymentId,
          lotId: paymentRow.lotId,
          buyerUserId: paymentRow.paidByUserId ?? paymentRow.buyerId ?? null,
          amountCents: expectedPence,
          amountRemainingCents,
          currency: paymentIntent.currency?.toUpperCase() ?? "GBP",
        },
        actorUserId: null,
        actingLegalEntityId: paymentRow.buyerLegalEntityId ?? null,
      });

      recordMoneyPathEvent("payment_intent_partially_funded");
      return { processed: true, action: "payment_intent_partially_funded" };
    });
  }
}
