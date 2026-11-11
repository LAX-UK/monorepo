import {
  StripeWebhookNotConfiguredError,
  StripeWebhookSignatureError,
} from "../../lib/stripe-webhook-verifier.js";
import type { StripeWebhookVerifier } from "../../lib/stripe-webhook-verifier.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import { dispatchStripePaymentEvent } from "../../routes/webhooks/stripe-payment-event-registry.js";
import type {
  IStripeWebhookIngressApplicationService,
  StripeWebhookIngressResult,
} from "../interfaces/finance-routes/finance-stripe-webhook-ingress.js";
import { StripeConnectNotConfiguredError } from "../interfaces/stripe-connect.js";
import type { IStripeConnectService } from "../interfaces/stripe-connect.js";
import type { StripePaymentWebhookService } from "../stripe-payment-webhook.service.js";

function recordStripeWebhookHttpError(
  surface: "connect" | "transfers" | "payments",
  status: number,
): void {
  if (status >= 500) recordMoneyPathEvent(`stripe_webhook_${surface}_5xx`);
  else if (status >= 400) recordMoneyPathEvent(`stripe_webhook_${surface}_4xx`);
}

function mapWebhookError(
  surface: "connect" | "transfers" | "payments",
  err: unknown,
): StripeWebhookIngressResult | null {
  if (err instanceof StripeWebhookNotConfiguredError) {
    recordStripeWebhookHttpError(surface, 503);
    return { ok: false, status: 503, body: { error: err.message } };
  }
  if (err instanceof StripeWebhookSignatureError) {
    recordStripeWebhookHttpError(surface, 401);
    const code =
      err.message === "missing_stripe_signature" ? "missing_stripe_signature" : "invalid_signature";
    return { ok: false, status: 401, body: { error: code } };
  }
  if (err instanceof StripeConnectNotConfiguredError) {
    recordStripeWebhookHttpError(surface, 503);
    return { ok: false, status: 503, body: { error: "stripe_not_configured" } };
  }
  const message = err instanceof Error ? err.message : "webhook_error";
  if (message.includes("signature") || message === "missing_stripe_signature") {
    recordStripeWebhookHttpError(surface, 401);
    return {
      ok: false,
      status: 401,
      body: {
        error:
          message === "missing_stripe_signature" ? "missing_stripe_signature" : "invalid_signature",
      },
    };
  }
  if (message.includes("not_configured")) {
    recordStripeWebhookHttpError(surface, 503);
    return { ok: false, status: 503, body: { error: "stripe_not_configured" } };
  }
  return null;
}

export class StripeWebhookIngressApplicationService
  implements IStripeWebhookIngressApplicationService
{
  constructor(
    private readonly stripeWebhookVerifier: StripeWebhookVerifier,
    private readonly stripeConnectService: IStripeConnectService,
    private readonly stripePaymentWebhookService: StripePaymentWebhookService | null,
  ) {}

  async handleConnectedAccountEvent(
    rawBody: string,
    signature: string | undefined,
  ): Promise<StripeWebhookIngressResult> {
    try {
      const event = this.stripeWebhookVerifier.verify("connect", rawBody, signature);
      const result = await this.stripeConnectService.handleConnectedAccountEvent(event);
      return { ok: true, status: 200, body: { ok: true, processed: result.processed } };
    } catch (err) {
      const mapped = mapWebhookError("connect", err);
      if (mapped) return mapped;
      throw err;
    }
  }

  async handleTransferEvent(
    rawBody: string,
    signature: string | undefined,
  ): Promise<StripeWebhookIngressResult> {
    try {
      const event = this.stripeWebhookVerifier.verify("transfers", rawBody, signature);
      const result = await this.stripeConnectService.handleTransferEvent(event);
      return { ok: true, status: 200, body: { ok: true, processed: result.processed } };
    } catch (err) {
      const mapped = mapWebhookError("transfers", err);
      if (mapped) return mapped;
      throw err;
    }
  }

  async handlePaymentEvent(
    rawBody: string,
    signature: string | undefined,
  ): Promise<StripeWebhookIngressResult> {
    if (!this.stripePaymentWebhookService) {
      recordStripeWebhookHttpError("payments", 503);
      return { ok: false, status: 503, body: { error: "stripe_payments_not_configured" } };
    }
    try {
      const event = this.stripeWebhookVerifier.verify("payments", rawBody, signature);
      const result = await dispatchStripePaymentEvent(this.stripePaymentWebhookService, event);

      if (
        !result.processed &&
        (result.reason === "payment_not_found" ||
          result.reason === "amount_mismatch" ||
          result.reason === "missing_charge_id")
      ) {
        recordMoneyPathEvent(`stripe_payment_webhook_${result.reason}`);
        recordStripeWebhookHttpError("payments", 500);
        return { ok: false, status: 500, body: { ok: false, ...result } };
      }

      return { ok: true, status: 200, body: { ok: true, ...result } };
    } catch (err) {
      const mapped = mapWebhookError("payments", err);
      if (mapped) return mapped;
      const message = err instanceof Error ? err.message : "handler_error";
      recordStripeWebhookHttpError("payments", 500);
      return { ok: false, status: 500, body: { error: message } };
    }
  }
}
