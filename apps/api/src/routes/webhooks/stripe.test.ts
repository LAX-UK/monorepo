import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../../container.js";
import {
  StripeWebhookNotConfiguredError,
  StripeWebhookSignatureError,
} from "../../lib/stripe-webhook-verifier.js";
import { createStripeWebhookRoutes } from "./stripe.js";

function makeContainer(overrides: Partial<Container> = {}): Container {
  const stripeConnectService = {
    handleConnectedAccountEvent: vi.fn().mockResolvedValue({ processed: true }),
    handleTransferEvent: vi.fn().mockResolvedValue({ processed: true }),
  };
  return {
    env: {
      STRIPE_TRANSFERS_WEBHOOK_SECRET: "whsec_test",
    },
    stripeWebhookVerifier: {
      verify: vi.fn(),
    },
    stripeConnectService,
    stripePaymentWebhookService: null,
    db: {},
    domainEventPublisher: {},
    marketingEventService: { enqueue: vi.fn() },
    ...overrides,
  } as unknown as Container;
}

describe("POST /webhooks/stripe/transfers", () => {
  it("returns 401 when signature verification fails", async () => {
    const container = makeContainer();
    vi.mocked(container.stripeWebhookVerifier.verify).mockImplementation(() => {
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
    const container = makeContainer();
    vi.mocked(container.stripeWebhookVerifier.verify).mockImplementation(() => {
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
    const container = makeContainer();
    const event = {
      id: "evt_tr",
      type: "transfer.created",
      data: { object: { id: "tr_1" } },
    } as unknown as Stripe.Event;
    vi.mocked(container.stripeWebhookVerifier.verify).mockReturnValue(event);
    const app = createStripeWebhookRoutes(container);

    const res = await app.request("/transfers", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "sig" },
    });

    expect(res.status).toBe(200);
    expect(container.stripeConnectService.handleTransferEvent).toHaveBeenCalledWith(event);
    expect(await res.json()).toEqual({ ok: true, processed: true });
  });
});
