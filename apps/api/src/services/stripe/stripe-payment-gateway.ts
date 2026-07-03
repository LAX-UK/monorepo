import Stripe from "stripe";
import type { Env } from "../../env.js";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import { StripeClientFactory } from "../../lib/stripe-client.js";
import { executeWithStripeRetries } from "../../lib/stripe-retries.js";
import { buildStripeCheckoutCustomText } from "../payment/stripe-checkout-product-display.js";
import type {
  CreateBankTransferCheckoutSessionInput,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
} from "./stripe-checkout-session.types.js";

export type StripeRefundInput = {
  chargeId: string;
  /** Amount in smallest currency unit (e.g. pence). Omit for full refund. */
  amount?: number;
  reason?: Stripe.RefundCreateParams["reason"];
};

export type StripeRefundGatewayResult =
  | { kind: "created"; refundId: string }
  | { kind: "already_refunded" };

export type {
  CreateBankTransferCheckoutSessionInput,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  StripeCheckoutLineItem,
} from "./stripe-checkout-session.types.js";

export interface IStripeCheckoutGateway {
  isConfigured(): boolean;
  createCardCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult>;
  createBankTransferCheckoutSession(
    input: CreateBankTransferCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult>;
  retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent>;
  retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session>;
  findChargeIdForPayment(paymentId: string): Promise<string | null>;
  /** Expire open Checkout sessions and cancel a cancellable PaymentIntent for this payment. */
  revokeOpenCheckoutForPayment(
    paymentId: string,
    paymentIntentId: string | null | undefined,
  ): Promise<void>;
}

export interface IStripeCaptureRefundGateway {
  isConfigured(): boolean;
  capturePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent>;
  createRefund(input: StripeRefundInput): Promise<StripeRefundGatewayResult>;
}

export interface IStripePaymentGateway
  extends IStripeCheckoutGateway,
    IStripeCaptureRefundGateway {}

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

  async createCardCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    const stripe = this.stripe;
    if (!stripe) {
      throw new Error("StripePaymentGateway: card checkout called while not configured");
    }
    return executeWithStripeRetries(async () => {
      const session = await stripe.checkout.sessions.create(
        this.buildCheckoutSessionParams(input, "card", {
          customer_email: input.buyerEmail,
        }),
        {
          idempotencyKey: input.idempotencyKey ?? `checkout:card:payment:${input.paymentId}`,
        },
      );
      return this.toCheckoutResult(session);
    });
  }

  async createBankTransferCheckoutSession(
    input: CreateBankTransferCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    const stripe = this.stripe;
    if (!stripe) {
      throw new Error("StripePaymentGateway: bank checkout called while not configured");
    }
    return executeWithStripeRetries(async () => {
      const session = await stripe.checkout.sessions.create(
        this.buildCheckoutSessionParams(input, "gb_bank_transfer", {
          customer: input.stripeCustomerId,
          payment_method_types: ["customer_balance"],
          payment_method_options: {
            customer_balance: {
              funding_type: "bank_transfer",
              bank_transfer: {
                type: "gb_bank_transfer",
              },
            },
          },
        }),
        {
          idempotencyKey: input.idempotencyKey ?? `checkout:bank:payment:${input.paymentId}`,
        },
      );
      return this.toCheckoutResult(session);
    });
  }

  private buildCheckoutSessionParams(
    input: CreateCheckoutSessionInput,
    checkoutRail: "card" | "gb_bank_transfer",
    extra: Stripe.Checkout.SessionCreateParams,
  ): Stripe.Checkout.SessionCreateParams {
    return {
      mode: "payment",
      locale: "en-GB",
      line_items: input.lineItems.map((item) => ({
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: item.unitAmountCents,
          product_data: {
            name: item.name,
            ...(item.description ? { description: item.description } : {}),
            ...(item.images?.length ? { images: item.images } : {}),
            metadata: {
              lotId: input.lotId,
              paymentId: input.paymentId,
              ...item.metadata,
            },
          },
        },
      })),
      custom_text: buildStripeCheckoutCustomText(),
      metadata: {
        paymentId: input.paymentId,
        lotId: input.lotId,
        checkoutRail,
      },
      payment_intent_data: {
        description: input.paymentIntentDescription,
        statement_descriptor_suffix: input.statementDescriptorSuffix,
        receipt_email: input.buyerEmail,
        metadata: {
          paymentId: input.paymentId,
          lotId: input.lotId,
          checkoutRail,
        },
      },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      ...extra,
    };
  }

  private toCheckoutResult(session: Stripe.Checkout.Session): CreateCheckoutSessionResult {
    if (!session.url) {
      throw new Error("Stripe Checkout session missing url");
    }
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);
    return { sessionId: session.id, url: session.url, paymentIntentId };
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    const stripe = this.stripe;
    if (!stripe) {
      throw new Error("StripePaymentGateway: retrieve PI called while not configured");
    }
    return executeWithStripeRetries(() => stripe.paymentIntents.retrieve(paymentIntentId));
  }

  async retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    const stripe = this.stripe;
    if (!stripe) {
      throw new Error(
        "StripePaymentGateway: retrieve checkout session called while not configured",
      );
    }
    return executeWithStripeRetries(() => stripe.checkout.sessions.retrieve(sessionId));
  }

  async revokeOpenCheckoutForPayment(
    paymentId: string,
    paymentIntentId: string | null | undefined,
  ): Promise<void> {
    const stripe = this.stripe;
    if (!stripe) return;

    const expireOpenSessionsForIntent = async (piId: string) => {
      const sessions = await executeWithStripeRetries(() =>
        stripe.checkout.sessions.list({ payment_intent: piId, limit: 10 }),
      );
      for (const session of sessions.data) {
        if (session.status !== "open") continue;
        await executeWithStripeRetries(() => stripe.checkout.sessions.expire(session.id));
      }
    };

    const cancelIntentIfOpen = async (piId: string) => {
      try {
        await executeWithStripeRetries(() =>
          stripe.paymentIntents.cancel(piId, {}, { idempotencyKey: `cancel:${piId}` }),
        );
      } catch (err) {
        if (
          err instanceof Stripe.errors.StripeError &&
          (err.code === "payment_intent_unexpected_state" || err.code === "resource_missing")
        ) {
          return;
        }
        throw err;
      }
    };

    if (paymentIntentId) {
      await expireOpenSessionsForIntent(paymentIntentId);
      await cancelIntentIfOpen(paymentIntentId);
      return;
    }

    try {
      const intents = await executeWithStripeRetries(() =>
        stripe.paymentIntents.search({
          query: `metadata['paymentId']:'${paymentId}'`,
          limit: 5,
        }),
      );
      for (const pi of intents.data) {
        if (
          pi.status !== "requires_payment_method" &&
          pi.status !== "requires_confirmation" &&
          pi.status !== "requires_action"
        ) {
          continue;
        }
        await expireOpenSessionsForIntent(pi.id);
        await cancelIntentIfOpen(pi.id);
      }
    } catch {
      // Search API may be unavailable; best-effort only.
    }
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
