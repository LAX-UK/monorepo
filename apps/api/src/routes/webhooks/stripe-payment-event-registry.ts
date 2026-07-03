import type Stripe from "stripe";
import type { StripePaymentWebhookService } from "../../services/stripe-payment-webhook.service.js";
import type { PaymentWebhookResult } from "../../services/stripe-webhook/payment-webhook-types.js";

type StripePaymentEventHandler = (
  service: StripePaymentWebhookService,
  event: Stripe.Event,
) => Promise<PaymentWebhookResult>;

export const STRIPE_PAYMENT_EVENT_HANDLERS: Partial<
  Record<Stripe.Event.Type, StripePaymentEventHandler>
> = {
  "payment_intent.succeeded": (service, event) =>
    service.handlePaymentIntentSucceeded(event, event.data.object as Stripe.PaymentIntent),
  "payment_intent.processing": (service, event) =>
    service.handlePaymentIntentProcessing(event, event.data.object as Stripe.PaymentIntent),
  "payment_intent.partially_funded": (service, event) =>
    service.handlePaymentIntentPartiallyFunded(event, event.data.object as Stripe.PaymentIntent),
  "payment_intent.payment_failed": (service, event) =>
    service.handlePaymentIntentFailed(event, event.data.object as Stripe.PaymentIntent),
  "payment_intent.canceled": (service, event) =>
    service.handlePaymentIntentCanceled(event, event.data.object as Stripe.PaymentIntent),
  "charge.dispute.created": (service, event) =>
    service.handleDisputeCreated(event, event.data.object as Stripe.Dispute),
  "charge.dispute.funds_withdrawn": (service, event) =>
    service.handleDisputeFundsWithdrawn(event, event.data.object as Stripe.Dispute),
  "charge.dispute.closed": (service, event) =>
    service.handleDisputeClosed(event, event.data.object as Stripe.Dispute),
  "charge.refunded": (service, event) =>
    service.handleChargeRefunded(event, event.data.object as Stripe.Charge),
  "checkout.session.async_payment_failed": (service, event) =>
    service.handleCheckoutSessionAsyncPaymentFailed(
      event,
      event.data.object as Stripe.Checkout.Session,
    ),
};

const UNHANDLED_PAYMENT_EVENT: PaymentWebhookResult = { processed: false };

export async function dispatchStripePaymentEvent(
  service: StripePaymentWebhookService,
  event: Stripe.Event,
): Promise<PaymentWebhookResult> {
  const handler = STRIPE_PAYMENT_EVENT_HANDLERS[event.type];
  if (!handler) return UNHANDLED_PAYMENT_EVENT;
  return handler(service, event);
}
