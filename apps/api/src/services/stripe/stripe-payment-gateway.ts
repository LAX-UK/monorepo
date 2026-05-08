import Stripe from "stripe";
import type { Env } from "../../env.js";
import { executeWithStripeRetries } from "../../lib/stripe-retries.js";

export type StripeRefundInput = {
  chargeId: string;
  /** Amount in smallest currency unit (e.g. pence). Omit for full refund. */
  amount?: number;
  reason?: Stripe.RefundCreateParams["reason"];
};

export type StripeRefundGatewayResult =
  | { kind: "created"; refundId: string }
  | { kind: "already_refunded" };

export interface IStripePaymentGateway {
  isConfigured(): boolean;
  capturePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent>;
  createRefund(input: StripeRefundInput): Promise<StripeRefundGatewayResult>;
}

export class StripePaymentGateway implements IStripePaymentGateway {
  private readonly stripe: Stripe | null;

  constructor(env: Pick<Env, "STRIPE_SECRET_KEY">) {
    this.stripe = env.STRIPE_SECRET_KEY
      ? new Stripe(env.STRIPE_SECRET_KEY, { typescript: true })
      : null;
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  async capturePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw new Error("StripePaymentGateway: capture called while not configured");
    }
    const stripe = this.stripe;
    return executeWithStripeRetries(async () => {
      try {
        return await stripe.paymentIntents.capture(paymentIntentId);
      } catch (err) {
        if (
          err instanceof Stripe.errors.StripeError &&
          err.code === "payment_intent_unexpected_state"
        ) {
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
          if (pi.status === "succeeded") {
            return pi;
          }
        }
        throw err;
      }
    });
  }

  async createRefund(input: StripeRefundInput): Promise<StripeRefundGatewayResult> {
    if (!this.stripe) {
      throw new Error("StripePaymentGateway: refund called while not configured");
    }
    const stripe = this.stripe;
    return executeWithStripeRetries(async () => {
      try {
        const params: Stripe.RefundCreateParams = {
          charge: input.chargeId,
          reason: input.reason ?? "requested_by_customer",
        };
        if (input.amount !== undefined) {
          params.amount = input.amount;
        }
        const refund = await stripe.refunds.create(params);
        return { kind: "created", refundId: refund.id };
      } catch (err) {
        if (err instanceof Stripe.errors.StripeError && err.code === "charge_already_refunded") {
          return { kind: "already_refunded" };
        }
        throw err;
      }
    });
  }
}
