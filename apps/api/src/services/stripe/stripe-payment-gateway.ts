import Stripe from "stripe";
import type { Env } from "../../env.js";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import { StripeClientFactory } from "../../lib/stripe-client.js";
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

export type CreateCheckoutSessionInput = {
  paymentId: string;
  lotId: string;
  amountCents: number;
  currency: string;
  buyerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type CreateCheckoutSessionResult = {
  sessionId: string;
  url: string;
  paymentIntentId: string | null;
};

export interface IStripePaymentGateway {
  isConfigured(): boolean;
  capturePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent>;
  createRefund(input: StripeRefundInput): Promise<StripeRefundGatewayResult>;
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult>;
  retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent>;
  /** Best-effort lookup of a platform charge id for a local payment row. */
  findChargeIdForPayment(paymentId: string): Promise<string | null>;
}

export class StripePaymentGateway implements IStripePaymentGateway {
  private readonly stripeFactory: IStripeClientFactory;

  constructor(env: Pick<Env, "STRIPE_SECRET_KEY">, stripeFactory?: IStripeClientFactory) {
    this.stripeFactory = stripeFactory ?? new StripeClientFactory(env);
  }

  private get stripe() {
    return this.stripeFactory.get();
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  async capturePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    const stripe = this.stripe;
    if (!stripe) {
      throw new Error("StripePaymentGateway: capture called while not configured");
    }
    return executeWithStripeRetries(async () => {
      try {
        return await stripe.paymentIntents.capture(
          paymentIntentId,
          {},
          { idempotencyKey: `capture:${paymentIntentId}` },
        );
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
    const stripe = this.stripe;
    if (!stripe) {
      throw new Error("StripePaymentGateway: refund called while not configured");
    }
    const idempotencyKey = `refund:${input.chargeId}:${input.amount ?? "full"}`;
    return executeWithStripeRetries(async () => {
      try {
        const params: Stripe.RefundCreateParams = {
          charge: input.chargeId,
          reason: input.reason ?? "requested_by_customer",
        };
        if (input.amount !== undefined) {
          params.amount = input.amount;
        }
        const refund = await stripe.refunds.create(params, { idempotencyKey });
        return { kind: "created", refundId: refund.id };
      } catch (err) {
        if (err instanceof Stripe.errors.StripeError && err.code === "charge_already_refunded") {
          return { kind: "already_refunded" };
        }
        throw err;
      }
    });
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    const stripe = this.stripe;
    if (!stripe) {
      throw new Error("StripePaymentGateway: checkout called while not configured");
    }
    return executeWithStripeRetries(async () => {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          customer_email: input.buyerEmail,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: input.currency.toLowerCase(),
                unit_amount: input.amountCents,
                product_data: {
                  name: "Auction lot payment",
                  metadata: { lotId: input.lotId },
                },
              },
            },
          ],
          metadata: {
            paymentId: input.paymentId,
            lotId: input.lotId,
          },
          payment_intent_data: {
            metadata: {
              paymentId: input.paymentId,
              lotId: input.lotId,
            },
          },
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
        },
        { idempotencyKey: `checkout:payment:${input.paymentId}` },
      );
      if (!session.url) {
        throw new Error("Stripe Checkout session missing url");
      }
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      return { sessionId: session.id, url: session.url, paymentIntentId };
    });
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    const stripe = this.stripe;
    if (!stripe) {
      throw new Error("StripePaymentGateway: retrieve PI called while not configured");
    }
    return executeWithStripeRetries(() => stripe.paymentIntents.retrieve(paymentIntentId));
  }

  async findChargeIdForPayment(paymentId: string): Promise<string | null> {
    const stripe = this.stripe;
    if (!stripe) return null;
    try {
      const result = await stripe.charges.search({
        query: `metadata['paymentId']:'${paymentId}'`,
        limit: 1,
      });
      const hit = result.data[0];
      if (hit?.id) return hit.id;
    } catch {
      // Search API may be unavailable; fall through.
    }
    try {
      const intents = await stripe.paymentIntents.search({
        query: `metadata['paymentId']:'${paymentId}'`,
        limit: 1,
      });
      const pi = intents.data[0];
      if (!pi?.latest_charge) return null;
      return typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge.id;
    } catch {
      return null;
    }
  }
}
