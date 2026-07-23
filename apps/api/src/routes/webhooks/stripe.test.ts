import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import type { ContainerStripeWebhookRoutesSlice } from "../../container.js";
import {
  StripeWebhookNotConfiguredError,
  StripeWebhookSignatureError,
} from "../../lib/stripe-webhook-verifier.js";
import { StripeWebhookIngressApplicationService } from "../../services/finance/stripe-webhook-ingress-application.service.js";
import type { StripePaymentWebhookService } from "../../services/stripe-payment-webhook.service.js";
import { createStripeWebhookRoutes } from "./stripe.js";

function makeStripeWebhookRoutesContainer(
  overrides: {
    stripePaymentWebhookService?: StripePaymentWebhookService | null;
  } = {},
) {
  const stripeConnectService = {
    handleConnectedAccountEvent: vi.fn().mockResolvedValue({ processed: true }),
    handleTransferEvent: vi.fn().mockResolvedValue({ processed: true }),
  };
  const stripeWebhookVerifier = {
    verify: vi.fn(),
  };
  const stripePaymentWebhookService =
    overrides.stripePaymentWebhookService !== undefined
      ? overrides.stripePaymentWebhookService
      : null;
  const stripeWebhooks = new StripeWebhookIngressApplicationService(
    stripeWebhookVerifier as never,
    stripeConnectService as never,
    stripePaymentWebhookService,
  );
  return {
    container: { finance: { stripeWebhooks } } as unknown as ContainerStripeWebhookRoutesSlice,
    stripeWebhookVerifier,
    stripeConnectService,
  };
}

describe("POST /webhooks/stripe/transfers", () => {
  it("returns 401 when signature verification fails", async () => {
    const { container, stripeWebhookVerifier } = makeStripeWebhookRoutesContainer();
    vi.mocked(stripeWebhookVerifier.verify).mockImplementation(() => {
      throw new StripeWebhookSignatureError("No signatures found");
    });
    const app = createStripeWebhookRoutes(container);

    const res = await app.request("/transfers", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "bad" },
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_signature" });
  });

  it("returns 503 when transfers webhook secret is not configured", async () => {
    const { container, stripeWebhookVerifier } = makeStripeWebhookRoutesContainer();
    vi.mocked(stripeWebhookVerifier.verify).mockImplementation(() => {
      throw new StripeWebhookNotConfiguredError("transfers");
    });
    const app = createStripeWebhookRoutes(container);

    const res = await app.request("/transfers", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "sig" },
    });

    expect(res.status).toBe(503);
  });

  it("delegates verified transfer events to StripeConnectService", async () => {
    const { container, stripeWebhookVerifier, stripeConnectService } =
      makeStripeWebhookRoutesContainer();
    const event = {
      id: "evt_tr",
      type: "transfer.created",
      data: { object: { id: "tr_1" } },
    } as unknown as Stripe.Event;
    vi.mocked(stripeWebhookVerifier.verify).mockReturnValue(event);
    const app = createStripeWebhookRoutes(container);

    const res = await app.request("/transfers", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "sig" },
    });

    expect(res.status).toBe(200);
    expect(stripeConnectService.handleTransferEvent).toHaveBeenCalledWith(event);
    expect(await res.json()).toEqual({ ok: true, processed: true });
  });
});

describe("POST /webhooks/stripe/payments", () => {
  it("returns 500 when dispute webhook is missing charge id so Stripe retries", async () => {
    const handleDisputeCreated = vi.fn().mockResolvedValue({
      processed: false,
      reason: "missing_charge_id",
    });
    const { container, stripeWebhookVerifier } = makeStripeWebhookRoutesContainer({
      stripePaymentWebhookService: {
        handleDisputeCreated,
      } as unknown as StripePaymentWebhookService,
    });
    const event = {
      id: "evt_dispute",
      type: "charge.dispute.created",
      data: { object: { id: "dp_1" } },
    } as unknown as Stripe.Event;
    vi.mocked(stripeWebhookVerifier.verify).mockReturnValue(event);
    const app = createStripeWebhookRoutes(container);

    const res = await app.request("/payments", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "sig" },
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, reason: "missing_charge_id" });
  });

  it("delegates payment_intent.succeeded to StripePaymentWebhookService", async () => {
    const handlePaymentIntentSucceeded = vi.fn().mockResolvedValue({
      processed: true,
      action: "payment_intent_succeeded",
    });
    const { container, stripeWebhookVerifier } = makeStripeWebhookRoutesContainer({
      stripePaymentWebhookService: {
        handlePaymentIntentSucceeded,
      } as unknown as StripePaymentWebhookService,
    });
    const event = {
      id: "evt_pi_ok",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_1",
          amount: 10000,
          metadata: { paymentId: "pay_1" },
          latest_charge: "ch_1",
        },
      },
    } as unknown as Stripe.Event;
    vi.mocked(stripeWebhookVerifier.verify).mockReturnValue(event);
    const app = createStripeWebhookRoutes(container);

    const res = await app.request("/payments", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "sig" },
    });

    expect(res.status).toBe(200);
    expect(handlePaymentIntentSucceeded).toHaveBeenCalledWith(event, event.data.object);
    expect(await res.json()).toMatchObject({ ok: true, action: "payment_intent_succeeded" });
  });
});
