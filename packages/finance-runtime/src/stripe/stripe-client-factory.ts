import Stripe from "stripe";

/** Pinned to match stripe@22.x default API version (see apps/api/src/lib/stripe-client.ts). */
export const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

export interface IStripeClientFactory {
  get(): Stripe | null;
}

export class StripeClientFactory implements IStripeClientFactory {
  private readonly client: Stripe | null;

  constructor(stripeSecretKey: string | undefined) {
    this.client = stripeSecretKey
      ? new Stripe(stripeSecretKey, {
          apiVersion: STRIPE_API_VERSION,
          typescript: true,
          maxNetworkRetries: 0,
        })
      : null;
  }

  get(): Stripe | null {
    return this.client;
  }
}
