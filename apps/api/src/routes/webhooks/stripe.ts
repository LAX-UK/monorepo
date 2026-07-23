import { Hono } from "hono";
import type { ContainerStripeWebhookRoutesSlice } from "../../container.js";

/** Stripe webhook hub — Connect, transfers, and payments (KYC uses Veriff). */
export function createStripeWebhookRoutes(container: ContainerStripeWebhookRoutesSlice) {
  const r = new Hono();

  r.post("/connect", async (c) => {
    const raw = await c.req.text();
    const signature = c.req.header("stripe-signature");
    const result = await container.finance.stripeWebhooks.handleConnectedAccountEvent(
      raw,
      signature,
    );
    return c.json(result.body, result.status);
  });

  r.post("/transfers", async (c) => {
    const raw = await c.req.text();
    const signature = c.req.header("stripe-signature");
    const result = await container.finance.stripeWebhooks.handleTransferEvent(raw, signature);
    return c.json(result.body, result.status);
  });

  r.post("/payments", async (c) => {
    const raw = await c.req.text();
    const signature = c.req.header("stripe-signature");
    const result = await container.finance.stripeWebhooks.handlePaymentEvent(raw, signature);
    return c.json(result.body, result.status);
  });

  return r;
}
