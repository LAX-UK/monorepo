import type Stripe from "stripe";
import type { Env } from "../env.js";
import type { IStripeClientFactory } from "./stripe-client.js";

export type StripeWebhookSurface = "connect" | "transfers" | "payments";

export class StripeWebhookNotConfiguredError extends Error {
  constructor(surface: StripeWebhookSurface) {
    super(`stripe_${surface}_webhook_not_configured`);
    this.name = "StripeWebhookNotConfiguredError";
  }
}

export class StripeWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeWebhookSignatureError";
  }
}

export class StripeWebhookVerifier {
  private readonly secrets: Record<StripeWebhookSurface, string | undefined>;

  constructor(
    private readonly stripeFactory: IStripeClientFactory,
    env: Pick<
      Env,
      | "STRIPE_CONNECT_WEBHOOK_SECRET"
      | "STRIPE_TRANSFERS_WEBHOOK_SECRET"
      | "STRIPE_PAYMENTS_WEBHOOK_SECRET"
    >,
  ) {
    this.secrets = {
      connect: env.STRIPE_CONNECT_WEBHOOK_SECRET,
      transfers: env.STRIPE_TRANSFERS_WEBHOOK_SECRET,
      payments: env.STRIPE_PAYMENTS_WEBHOOK_SECRET,
    };
  }

  verify(
    surface: StripeWebhookSurface,
    rawBody: string,
    signature: string | undefined,
  ): Stripe.Event {
    const secret = this.secrets[surface];
    if (!secret) {
      throw new StripeWebhookNotConfiguredError(surface);
    }
    if (!signature) {
      throw new StripeWebhookSignatureError("missing_stripe_signature");
    }

    const stripe = this.stripeFactory.require();
    try {
      return stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "webhook_error";
      if (message.includes("signature")) {
        throw new StripeWebhookSignatureError(message);
      }
      throw err;
    }
  }
}
