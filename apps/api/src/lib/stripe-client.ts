import Stripe from "stripe";
import type { Env } from "../env.js";

/** Pinned to match stripe@22.1.x default API version. */
export const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("stripe_not_configured: set STRIPE_SECRET_KEY");
    this.name = "StripeNotConfiguredError";
  }
}

export interface IStripeClientFactory {
  get(): Stripe | null;
  require(): Stripe;
}

export class StripeClientFactory implements IStripeClientFactory {
  private readonly client: Stripe | null;

  constructor(env: Pick<Env, "STRIPE_SECRET_KEY">) {
    this.client = env.STRIPE_SECRET_KEY
      ? new Stripe(env.STRIPE_SECRET_KEY, {
          apiVersion: STRIPE_API_VERSION,
          typescript: true,
          maxNetworkRetries: 0,
          telemetry: true,
        })
      : null;
  }

  get(): Stripe | null {
    return this.client;
  }

  require(): Stripe {
    if (!this.client) {
      throw new StripeNotConfiguredError();
    }
    return this.client;
  }
}
