import Stripe from "stripe";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import { executeWithStripeRetries } from "../../lib/stripe-retries.js";
import type {
  CreateGroupCheckoutInput,
  GroupChargeRefund,
  GroupCheckoutSession,
  IPaymentGroupGateway,
} from "../payment-group/payment-group-ports.js";
import {
  buildStripeCheckoutCustomText,
  truncateForStripe,
} from "../payment/stripe-checkout-product-display.js";

const PRODUCT_NAME_MAX = 250;
/** Refunds that took or are taking money back; failed and cancelled ones returned nothing. */
const COUNTED_REFUND_STATUSES = new Set(["succeeded", "pending", "requires_action"]);

/** The idempotency key of a group's checkout: one per group and rail, never per attempt. */
export function groupCheckoutIdempotencyKey(
  rail: CreateGroupCheckoutInput["rail"],
  paymentGroupId: string,
): string {
  return `checkout:${rail === "card" ? "card" : "bank"}:group:${paymentGroupId}`;
}

function lineName(line: CreateGroupCheckoutInput["lines"][number]): string {
  const title = line.lotTitle.trim() || "Untitled lot";
  const ref = line.lotNumber != null ? `Lot ${line.lotNumber} · ` : "";
  return truncateForStripe(`${ref}${title}`, PRODUCT_NAME_MAX);
}

/** Stripe Checkout for "Pay several": one session and one PaymentIntent for the whole group. */
export class StripePaymentGroupGateway implements IPaymentGroupGateway {
  constructor(private readonly stripeFactory: IStripeClientFactory) {}

  isConfigured(): boolean {
    return this.stripeFactory.get() !== null;
  }

  async createCheckout(input: CreateGroupCheckoutInput): Promise<GroupCheckoutSession> {
    const stripe = this.stripeFactory.require();
    if (input.rail === "gb_bank_transfer" && !input.stripeCustomerId) {
      throw new Error("A bank transfer checkout needs the buyer's Stripe customer");
    }
    const metadata = { paymentGroupId: input.paymentGroupId, checkoutRail: input.rail };
    const count = input.lines.length;
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      locale: "en-GB",
      line_items: input.lines.map((line) => ({
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: line.amountPence,
          product_data: {
            name: lineName(line),
            description: "LAX auction settlement",
            metadata: { lotId: line.lotId, paymentId: line.paymentId, ...metadata },
          },
        },
      })),
      custom_text: buildStripeCheckoutCustomText(),
      metadata,
      payment_intent_data: {
        description: `Auction settlement — ${count} invoices paid together`,
        statement_descriptor_suffix: `${count} LOTS`,
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
        idempotencyKey: groupCheckoutIdempotencyKey(input.rail, input.paymentGroupId),
      }),
    );
    if (!session.url) throw new Error("Stripe Checkout session missing url");
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);
    return { sessionId: session.id, url: session.url, paymentIntentId };
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

  async listChargeRefunds(chargeId: string): Promise<GroupChargeRefund[]> {
    const stripe = this.stripeFactory.require();
    const refunds: GroupChargeRefund[] = [];
    for await (const refund of stripe.refunds.list({ charge: chargeId, limit: 100 })) {
      if (!COUNTED_REFUND_STATUSES.has(refund.status ?? "")) continue;
      refunds.push({ paymentId: refund.metadata?.paymentId ?? null, amountPence: refund.amount });
    }
    return refunds;
  }
}
