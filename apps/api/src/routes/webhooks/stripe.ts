import { Hono } from "hono";
import type Stripe from "stripe";
import type { Container } from "../../container.js";
import {
  StripeWebhookNotConfiguredError,
  StripeWebhookSignatureError,
} from "../../lib/stripe-webhook-verifier.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import { StripeConnectNotConfiguredError } from "../../services/interfaces/stripe-connect.js";

function recordStripeWebhookHttpError(
  surface: "connect" | "transfers" | "payments",
  status: number,
): void {
  if (status >= 500) recordMoneyPathEvent(`stripe_webhook_${surface}_5xx`);
  else if (status >= 400) recordMoneyPathEvent(`stripe_webhook_${surface}_4xx`);
}

function webhookErrorResponse(
  surface: "connect" | "transfers" | "payments",
  err: unknown,
): { status: 401 | 503; body: Record<string, string> } | null {
  if (err instanceof StripeWebhookNotConfiguredError) {
    recordStripeWebhookHttpError(surface, 503);
    return { status: 503, body: { error: err.message } };
  }
  if (err instanceof StripeWebhookSignatureError) {
    recordStripeWebhookHttpError(surface, 401);
    const code =
      err.message === "missing_stripe_signature" ? "missing_stripe_signature" : "invalid_signature";
    return { status: 401, body: { error: code } };
  }
  if (err instanceof StripeConnectNotConfiguredError) {
    recordStripeWebhookHttpError(surface, 503);
    return { status: 503, body: { error: "stripe_not_configured" } };
  }
  const message = err instanceof Error ? err.message : "webhook_error";
  if (message.includes("signature") || message === "missing_stripe_signature") {
    recordStripeWebhookHttpError(surface, 401);
    return {
      status: 401,
      body: {
        error:
          message === "missing_stripe_signature" ? "missing_stripe_signature" : "invalid_signature",
      },
    };
  }
  if (message.includes("not_configured")) {
    recordStripeWebhookHttpError(surface, 503);
    return { status: 503, body: { error: "stripe_not_configured" } };
  }
  return null;
}

/** Stripe webhook hub — Connect, transfers, and payments (KYC uses Veriff). */
export function createStripeWebhookRoutes(container: Container) {
  const r = new Hono();

  r.post("/connect", async (c) => {
    const raw = await c.req.text();
    const signature = c.req.header("stripe-signature");
    try {
      const event = container.stripeWebhookVerifier.verify("connect", raw, signature);
      const result = await container.stripeConnectService.handleConnectedAccountEvent(event);
      return c.json({ ok: true, processed: result.processed });
    } catch (err) {
      const mapped = webhookErrorResponse("connect", err);
      if (mapped) return c.json(mapped.body, mapped.status);
      throw err;
    }
  });

  r.post("/transfers", async (c) => {
    const raw = await c.req.text();
    const signature = c.req.header("stripe-signature");
    try {
      const event = container.stripeWebhookVerifier.verify("transfers", raw, signature);
      const result = await container.stripeConnectService.handleTransferEvent(event);
      return c.json({ ok: true, processed: result.processed });
    } catch (err) {
      const mapped = webhookErrorResponse("transfers", err);
      if (mapped) return c.json(mapped.body, mapped.status);
      throw err;
    }
  });

  r.post("/payments", async (c) => {
    if (!container.stripePaymentWebhookService) {
      recordStripeWebhookHttpError("payments", 503);
      return c.json({ error: "stripe_payments_not_configured" }, 503);
    }

    const raw = await c.req.text();
    const signature = c.req.header("stripe-signature");
    try {
      const event = container.stripeWebhookVerifier.verify("payments", raw, signature);
      let result = { processed: false };

      if (event.type === "charge.dispute.created") {
        const dispute = event.data.object as Stripe.Dispute;
        result = await container.stripePaymentWebhookService.handleDisputeCreated(event, dispute);
      } else if (event.type === "charge.dispute.funds_withdrawn") {
        const dispute = event.data.object as Stripe.Dispute;
        result = await container.stripePaymentWebhookService.handleDisputeFundsWithdrawn(
          event,
          dispute,
        );
      } else if (event.type === "charge.dispute.closed") {
        const dispute = event.data.object as Stripe.Dispute;
        result = await container.stripePaymentWebhookService.handleDisputeClosed(event, dispute);
      } else if (event.type === "charge.refunded") {
        const charge = event.data.object as Stripe.Charge;
        result = await container.stripePaymentWebhookService.handleChargeRefunded(event, charge);
      }

      return c.json({ ok: true, ...result });
    } catch (err) {
      const mapped = webhookErrorResponse("payments", err);
      if (mapped) return c.json(mapped.body, mapped.status);
      const message = err instanceof Error ? err.message : "handler_error";
      recordStripeWebhookHttpError("payments", 500);
      return c.json({ error: message }, 500);
    }
  });

  return r;
}
