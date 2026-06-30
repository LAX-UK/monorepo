import type Stripe from "stripe";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import { chargeIdFromPaymentIntent } from "../stripe/stripe-charge-id.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";
import {
  PAYMENT_WEBHOOK_EVENT_SOURCE,
  type PaymentWebhookResult,
} from "./payment-webhook-types.js";

export async function handlePaymentIntentSucceeded(
  deps: StripePaymentWebhookDeps,
  event: Stripe.Event,
  paymentIntent: Stripe.PaymentIntent,
): Promise<PaymentWebhookResult> {
  const paymentId = paymentIntent.metadata?.paymentId;
  if (!paymentId) {
    return { processed: true, action: "skipped", reason: "missing_payment_id_metadata" };
  }

  const paymentRow = await deps.payments.findById(paymentId);
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

  return deps.db.transaction(async (tx) => {
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
      await deps.domainEventPublisher.publish(tx, {
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

    await deps.paymentCapture.capture({
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

export async function handlePaymentIntentProcessing(
  deps: StripePaymentWebhookDeps,
  event: Stripe.Event,
  paymentIntent: Stripe.PaymentIntent,
): Promise<PaymentWebhookResult> {
  const paymentId = paymentIntent.metadata?.paymentId;
  if (!paymentId) {
    return { processed: true, action: "skipped", reason: "missing_payment_id_metadata" };
  }

  const paymentRow = await deps.payments.findById(paymentId);
  if (!paymentRow) {
    recordMoneyPathEvent("stripe_payment_webhook_payment_not_found");
    return { processed: false, action: "skipped", reason: "payment_not_found" };
  }

  const expectedPence = gbpAmountToPence(paymentRow.amount);
  if (paymentIntent.amount !== expectedPence) {
    recordMoneyPathEvent("payment_intent_amount_mismatch");
    return { processed: false, action: "skipped", reason: "amount_mismatch" };
  }

  return deps.db.transaction(async (tx) => {
    const { claimed } = await tryClaimProcessedStripeEvent(
      tx,
      event.id,
      PAYMENT_WEBHOOK_EVENT_SOURCE,
    );
    if (!claimed) {
      return { processed: false, action: "skipped", reason: "duplicate_event" };
    }

    await deps.payments.applyAuthorizedInTransaction(tx, paymentId);
    recordMoneyPathEvent("payment_intent_processing");
    return { processed: true, action: "payment_intent_processing" };
  });
}

export async function handlePaymentIntentPartiallyFunded(
  deps: StripePaymentWebhookDeps,
  event: Stripe.Event,
  paymentIntent: Stripe.PaymentIntent,
): Promise<PaymentWebhookResult> {
  const paymentId = paymentIntent.metadata?.paymentId;
  if (!paymentId) {
    return { processed: true, action: "skipped", reason: "missing_payment_id_metadata" };
  }

  const paymentRow = await deps.payments.findById(paymentId);
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

  return deps.db.transaction(async (tx) => {
    const { claimed } = await tryClaimProcessedStripeEvent(
      tx,
      event.id,
      PAYMENT_WEBHOOK_EVENT_SOURCE,
    );
    if (!claimed) {
      return { processed: false, action: "skipped", reason: "duplicate_event" };
    }

    await deps.payments.applyAuthorizedInTransaction(tx, paymentId);

    await deps.domainEventPublisher.publish(tx, {
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

export async function handlePaymentIntentFailed(
  deps: StripePaymentWebhookDeps,
  event: Stripe.Event,
  paymentIntent: Stripe.PaymentIntent,
): Promise<PaymentWebhookResult> {
  const paymentId = paymentIntent.metadata?.paymentId;
  if (!paymentId) {
    return { processed: true, action: "skipped", reason: "missing_payment_id_metadata" };
  }

  const paymentRow = await deps.payments.findById(paymentId);
  if (!paymentRow) {
    recordMoneyPathEvent("stripe_payment_webhook_payment_not_found");
    return { processed: false, action: "skipped", reason: "payment_not_found" };
  }

  return deps.db.transaction(async (tx) => {
    const { claimed } = await tryClaimProcessedStripeEvent(
      tx,
      event.id,
      PAYMENT_WEBHOOK_EVENT_SOURCE,
    );
    if (!claimed) {
      return { processed: false, action: "skipped", reason: "duplicate_event" };
    }

    await deps.domainEventPublisher.publish(tx, {
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

export async function handlePaymentIntentCanceled(
  deps: StripePaymentWebhookDeps,
  event: Stripe.Event,
  paymentIntent: Stripe.PaymentIntent,
): Promise<PaymentWebhookResult> {
  const paymentId = paymentIntent.metadata?.paymentId;
  if (!paymentId) {
    return { processed: true, action: "skipped", reason: "missing_payment_id_metadata" };
  }

  const paymentRow = await deps.payments.findById(paymentId);
  if (!paymentRow) {
    recordMoneyPathEvent("stripe_payment_webhook_payment_not_found");
    return { processed: false, action: "skipped", reason: "payment_not_found" };
  }

  return deps.db.transaction(async (tx) => {
    const { claimed } = await tryClaimProcessedStripeEvent(
      tx,
      event.id,
      PAYMENT_WEBHOOK_EVENT_SOURCE,
    );
    if (!claimed) {
      return { processed: false, action: "skipped", reason: "duplicate_event" };
    }

    const cancelled = await deps.payments.applyCancelledInTransaction(tx, paymentId);
    if (cancelled) {
      await deps.domainEventPublisher.publish(tx, {
        aggregateType: "payment",
        aggregateId: paymentId,
        eventType: "payment.cancelled",
        payload: {
          lotId: paymentRow.lotId,
          buyerUserId: paymentRow.paidByUserId ?? paymentRow.buyerId ?? null,
          reason: "stripe_payment_intent_canceled",
        },
        actorUserId: null,
        actingLegalEntityId: paymentRow.buyerLegalEntityId ?? null,
      });
    }

    recordMoneyPathEvent("payment_intent_canceled");
    return { processed: true, action: "payment_intent_canceled" };
  });
}

export async function handleCheckoutSessionAsyncPaymentFailed(
  deps: StripePaymentWebhookDeps,
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
): Promise<PaymentWebhookResult> {
  const paymentId = session.metadata?.paymentId;
  if (!paymentId) {
    return { processed: true, action: "skipped", reason: "missing_payment_id_metadata" };
  }

  const paymentRow = await deps.payments.findById(paymentId);
  if (!paymentRow) {
    recordMoneyPathEvent("stripe_payment_webhook_payment_not_found");
    return { processed: false, action: "skipped", reason: "payment_not_found" };
  }

  return deps.db.transaction(async (tx) => {
    const { claimed } = await tryClaimProcessedStripeEvent(
      tx,
      event.id,
      PAYMENT_WEBHOOK_EVENT_SOURCE,
    );
    if (!claimed) {
      return { processed: false, action: "skipped", reason: "duplicate_event" };
    }

    const cancelled = await deps.payments.applyCancelledInTransaction(tx, paymentId);
    if (cancelled) {
      await deps.domainEventPublisher.publish(tx, {
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
