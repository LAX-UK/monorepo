import { Hono } from "hono";
import Stripe from "stripe";
import type { Container } from "../../container.js";
import { KycNotConfiguredError } from "../../services/interfaces/kyc-service.js";
import { progressIndividualsAfterIdentityVerification } from "../../services/kyc/kyc-post-verification-progression.js";

/** Stripe webhook hub. We expose three endpoints — one per webhook secret —
 * because Stripe Identity, Stripe Connect, and Stripe Payments have separate
 * signing secrets in the dashboard:
 * * - POST /webhooks/stripe/identity → Stripe Identity events
 * - POST /webhooks/stripe/connect  → Stripe Connect events
 * - POST /webhooks/stripe/payments → Stripe Payment events
 */
export function createStripeWebhookRoutes(container: Container) {
  const r = new Hono();

  r.post("/identity", async (c) => {
    const raw = await c.req.text();
    const signature = c.req.header("stripe-signature");
    try {
      const { verification: updated, shouldProgressIndividuals } =
        await container.kycService.handleWebhook(raw, signature);
      if (shouldProgressIndividuals && updated) {
        await progressIndividualsAfterIdentityVerification(
          container.db,
          container.domainEventPublisher,
          updated.userId,
        );
      }
      return c.json({ ok: true, processed: Boolean(updated) });
    } catch (err) {
      if (err instanceof KycNotConfiguredError) {
        return c.json({ error: "kyc_not_configured" }, 503);
      }
      const message = err instanceof Error ? err.message : "webhook_error";
      if (message.includes("signature")) {
        return c.json({ error: "invalid_signature" }, 401);
      }
      throw err;
    }
  });

  r.post("/connect", async (c) => {
    const raw = await c.req.text();
    const signature = c.req.header("stripe-signature");
    try {
      const result = await container.stripeConnectService.handleWebhook(raw, signature);
      return c.json({ ok: true, processed: result.processed });
    } catch (err) {
      const message = err instanceof Error ? err.message : "webhook_error";
      if (message.includes("signature")) {
        return c.json({ error: "invalid_signature" }, 401);
      }
      if (message.includes("not_configured")) {
        return c.json({ error: "stripe_not_configured" }, 503);
      }
      throw err;
    }
  });

  /** Payment-related webhooks (disputes, refunds).
   * charge.dispute.created, charge.dispute.closed, charge.refunded
   */
  r.post("/payments", async (c) => {
    if (!container.stripePaymentWebhookService) {
      return c.json({ error: "stripe_payments_not_configured" }, 503);
    }

    const raw = await c.req.text();
    const signature = c.req.header("stripe-signature");
    const webhookSecret = container.env.STRIPE_PAYMENTS_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return c.json({ error: "stripe_payments_webhook_not_configured" }, 503);
    }
    if (!signature) {
      return c.json({ error: "missing_stripe_signature" }, 401);
    }

    let event: Stripe.Event;
    try {
      const stripe = new Stripe(container.env.STRIPE_SECRET_KEY ?? "", { typescript: true });
      event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "webhook_error";
      if (message.includes("signature")) {
        return c.json({ error: "invalid_signature" }, 401);
      }
      throw err;
    }

    let result = { processed: false };

    try {
      if (event.type === "charge.dispute.created") {
        const dispute = event.data.object as Stripe.Dispute;
        result = await container.stripePaymentWebhookService.handleDisputeCreated(event, dispute);
      } else if (event.type === "charge.dispute.closed") {
        const dispute = event.data.object as Stripe.Dispute;
        result = await container.stripePaymentWebhookService.handleDisputeClosed(event, dispute);
      } else if (event.type === "charge.refunded") {
        const charge = event.data.object as Stripe.Charge;
        result = await container.stripePaymentWebhookService.handleChargeRefunded(event, charge);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "handler_error";
      return c.json({ error: message }, 500);
    }

    return c.json({ ok: true, ...result });
  });

  return r;
}
