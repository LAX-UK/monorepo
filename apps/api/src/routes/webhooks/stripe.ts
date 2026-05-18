import { Hono } from "hono";
import type Stripe from "stripe";
import type { Container } from "../../container.js";
import {
  StripeWebhookNotConfiguredError,
  StripeWebhookSignatureError,
} from "../../lib/stripe-webhook-verifier.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import { KycNotConfiguredError } from "../../services/interfaces/kyc-service.js";
import { StripeConnectNotConfiguredError } from "../../services/interfaces/stripe-connect.js";
import { progressIndividualsAfterIdentityVerification } from "../../services/kyc/kyc-post-verification-progression.js";

function recordStripeWebhookHttpError(
  surface: "identity" | "connect" | "transfers" | "payments",
  status: number,
): void {
  if (status >= 500) recordMoneyPathEvent(`stripe_webhook_${surface}_5xx`);
  else if (status >= 400) recordMoneyPathEvent(`stripe_webhook_${surface}_4xx`);
}

function webhookErrorResponse(
  surface: "identity" | "connect" | "transfers" | "payments",
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
  if (err instanceof KycNotConfiguredError) {
    recordStripeWebhookHttpError(surface, 503);
    return { status: 503, body: { error: "kyc_not_configured" } };
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

/** Stripe webhook hub — four endpoints, four signing secrets (see Connect webhooks docs).
 * - POST /webhooks/stripe/identity  → Stripe Identity (Your account)
 * - POST /webhooks/stripe/connect   → Connect account updates (Connected accounts)
 * - POST /webhooks/stripe/transfers → Platform transfers to sellers (Your account)
 * - POST /webhooks/stripe/payments  → Disputes and refunds (Your account)
 */
export function createStripeWebhookRoutes(container: Container) {
  const r = new Hono();

  r.post("/identity", async (c) => {
    const raw = await c.req.text();
    const signature = c.req.header("stripe-signature");
    try {
      const event = container.stripeWebhookVerifier.verify("identity", raw, signature);
      const result = await container.kycService.handleIdentityEvent(event);
      const { verification: updated, shouldProgressIndividuals } = result;
      if (shouldProgressIndividuals && updated) {
        await progressIndividualsAfterIdentityVerification(
          container.db,
          container.domainEventPublisher,
          updated.userId,
        );
      }
      if (result.marketingEventToEnqueue) {
        await container.marketingEventService.enqueue(result.marketingEventToEnqueue);
      }
      return c.json({ ok: true, processed: Boolean(updated) });
    } catch (err) {
      const mapped = webhookErrorResponse("identity", err);
      if (mapped) return c.json(mapped.body, mapped.status);
      throw err;
    }
  });

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

  /** Payment-related webhooks (disputes, refunds). */
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
