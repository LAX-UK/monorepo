import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import type { StripePaymentWebhookService } from "../../services/stripe-payment-webhook.service.js";
import {
  STRIPE_PAYMENT_EVENT_HANDLERS,
  dispatchStripePaymentEvent,
} from "./stripe-payment-event-registry.js";

function makeService(
  handlers: Partial<Record<keyof StripePaymentWebhookService, ReturnType<typeof vi.fn>>>,
): StripePaymentWebhookService {
  return handlers as unknown as StripePaymentWebhookService;
}

describe("STRIPE_PAYMENT_EVENT_HANDLERS", () => {
  it("covers all supported Stripe payment webhook event types", () => {
    expect(Object.keys(STRIPE_PAYMENT_EVENT_HANDLERS).sort()).toEqual(
      [
        "charge.dispute.closed",
        "charge.dispute.created",
        "charge.dispute.funds_withdrawn",
        "charge.refunded",
        "checkout.session.async_payment_failed",
        "payment_intent.canceled",
        "payment_intent.partially_funded",
        "payment_intent.payment_failed",
        "payment_intent.processing",
        "payment_intent.succeeded",
      ].sort(),
    );
  });
});

describe("dispatchStripePaymentEvent", () => {
  it("returns unprocessed for unknown event types", async () => {
    const service = makeService({});
    const event = { type: "customer.created", data: { object: {} } } as Stripe.Event;
    await expect(dispatchStripePaymentEvent(service, event)).resolves.toEqual({
      processed: false,
    });
  });

  it("delegates payment_intent.succeeded to the service handler", async () => {
    const paymentIntent = { id: "pi_1" } as Stripe.PaymentIntent;
    const handlePaymentIntentSucceeded = vi.fn().mockResolvedValue({
      processed: true,
      action: "payment_intent_succeeded",
    });
    const service = makeService({ handlePaymentIntentSucceeded });
    const event = {
      type: "payment_intent.succeeded",
      data: { object: paymentIntent },
    } as Stripe.Event;

    await expect(dispatchStripePaymentEvent(service, event)).resolves.toEqual({
      processed: true,
      action: "payment_intent_succeeded",
    });
    expect(handlePaymentIntentSucceeded).toHaveBeenCalledWith(event, paymentIntent);
  });

  it("delegates charge.dispute.created to the service handler", async () => {
    const dispute = { id: "dp_1" } as Stripe.Dispute;
    const handleDisputeCreated = vi.fn().mockResolvedValue({
      processed: false,
      reason: "missing_charge_id",
    });
    const service = makeService({ handleDisputeCreated });
    const event = {
      type: "charge.dispute.created",
      data: { object: dispute },
    } as Stripe.Event;

    await expect(dispatchStripePaymentEvent(service, event)).resolves.toEqual({
      processed: false,
      reason: "missing_charge_id",
    });
    expect(handleDisputeCreated).toHaveBeenCalledWith(event, dispute);
  });
});
