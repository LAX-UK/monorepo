import Stripe from "stripe";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import { executeWithStripeRetries } from "../../lib/stripe-retries.js";
import { buildStripeCheckoutCustomText } from "../payment/stripe-checkout-product-display.js";
import type {
  CreateDealCheckoutInput,
  DealCheckoutSession,
  DealCheckoutStatus,
  IDealCheckoutGateway,
} from "../private-sale-deal/deal-payment-ports.js";

/** The idempotency key of a deal payment's checkout: one per payment. */
export function dealCheckoutIdempotencyKey(paymentId: string): string {
  return `checkout:deal:${paymentId}`;
}

/** Stripe Checkout for a private sale deal: one session and one PaymentIntent for the amount due. */
export class StripeDealCheckoutGateway implements IDealCheckoutGateway {
  constructor(private readonly stripeFactory: IStripeClientFactory) {}

  isConfigured(): boolean {
    return this.stripeFactory.get() !== null;
  }

  async createCheckout(input: CreateDealCheckoutInput): Promise<DealCheckoutSession> {
    const stripe = this.stripeFactory.require();
    if (input.rail === "gb_bank_transfer" && !input.stripeCustomerId) {
      throw new Error("A bank transfer checkout needs the buyer's Stripe customer");
    }
    const metadata = {
      privateSaleDealId: input.dealId,
      privateSaleDealPaymentId: input.paymentId,
      checkoutRail: input.rail,
    };
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      locale: "en-GB",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amountPence,
            product_data: { name: `Private sale ${input.reference}`, metadata },
          },
        },
      ],
      custom_text: buildStripeCheckoutCustomText(),
      metadata,
      payment_intent_data: {
        description: `Private sale ${input.reference}`,
        receipt_email: input.buyerEmail,
        metadata,
      },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      ...(input.rail === "gb_bank_transfer"
        ? {
            customer: input.stripeCustomerId as string,
            payment_method_types: ["customer_balance"],
            payment_method_options: {
              customer_balance: {
                funding_type: "bank_transfer",
                bank_transfer: { type: "gb_bank_transfer" },
              },
            },
          }
        : { customer_email: input.buyerEmail }),
    };
    const session = await executeWithStripeRetries(() =>
      stripe.checkout.sessions.create(params, {
        idempotencyKey: dealCheckoutIdempotencyKey(input.paymentId),
      }),
    );
    if (!session.url) throw new Error("Stripe Checkout session missing url");
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);
    return { sessionId: session.id, url: session.url, paymentIntentId };
  }

  async checkoutStatus(sessionId: string): Promise<DealCheckoutStatus> {
    const stripe = this.stripeFactory.require();
    const session = await executeWithStripeRetries(() =>
      stripe.checkout.sessions.retrieve(sessionId),
    );
    if (session.status === "complete") return "complete";
    if (session.status === "expired") return "expired";
    // A session past its own expiry is over even before the provider marks it.
    const lapsed = session.expires_at != null && session.expires_at * 1000 <= Date.now();
    return lapsed ? "expired" : "open";
  }

  async expireCheckout(sessionId: string): Promise<void> {
    const stripe = this.stripeFactory.require();
    try {
      await executeWithStripeRetries(() => stripe.checkout.sessions.expire(sessionId));
    } catch (err) {
      // Already complete or expired: nothing left to end.
      if (err instanceof Stripe.errors.StripeInvalidRequestError) return;
      throw err;
    }
  }
}
