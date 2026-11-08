import type { BankTransferInstructions } from "@auction/types";
import Stripe from "stripe";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import { executeWithStripeRetries } from "../../lib/stripe-retries.js";
import type {
  CreateGroupCheckoutInput,
  GroupChargeRefund,
  GroupCheckoutSession,
  GroupCheckoutStatus,
  IPaymentGroupGateway,
} from "../payment-group/payment-group-ports.js";
import { InvoiceLinesError, assertWithinStripeLineLimit } from "../payment/invoice-stripe-lines.js";
import {
  buildStripeCheckoutCustomText,
  stripeLineName,
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

/** One Stripe line per stored invoice line, at exactly the stored pence. */
export function groupStripeLineItems(
  input: Pick<CreateGroupCheckoutInput, "currency" | "lines" | "deliveries" | "totalPence">,
  metadata: Record<string, string>,
): NonNullable<Stripe.Checkout.SessionCreateParams["line_items"]> {
  const items = input.lines.flatMap((line) => {
    const sum = line.invoiceLines.reduce((total, l) => total + l.amountPence, 0);
    if (line.invoiceLines.length === 0 || sum !== line.amountPence) {
      throw new InvoiceLinesError(
        "invoice_mismatch",
        `Invoice lines for payment ${line.paymentId} add up to ${sum} pence, not ${line.amountPence}`,
      );
    }
    const title = line.lotTitle.trim() || "Untitled lot";
    return line.invoiceLines.map((invoiceLine) => ({
      quantity: 1,
      price_data: {
        currency: input.currency.toLowerCase(),
        unit_amount: invoiceLine.amountPence,
        product_data: {
          name: stripeLineName(line, invoiceLine),
          description: truncateForStripe(title, PRODUCT_NAME_MAX),
          metadata: {
            lotId: line.lotId,
            paymentId: line.paymentId,
            lineKind: invoiceLine.kind,
            ...metadata,
          },
        },
      },
    }));
  });
  const deliveryItems = input.deliveries.map((delivery) => ({
    quantity: 1,
    price_data: {
      currency: input.currency.toLowerCase(),
      unit_amount: delivery.amountPence,
      product_data: {
        name: stripeLineName(delivery, { label: "Courier delivery" }),
        description: truncateForStripe(
          delivery.lotTitle.trim() || "Untitled lot",
          PRODUCT_NAME_MAX,
        ),
        metadata: {
          lotId: delivery.lotId,
          deliveryQuoteId: delivery.quoteId,
          lineKind: "delivery",
          ...metadata,
        },
      },
    },
  }));
  const all = [...items, ...deliveryItems];
  assertWithinStripeLineLimit(all.length);
  const total = all.reduce((sum, item) => sum + (item.price_data?.unit_amount ?? 0), 0);
  if (total !== input.totalPence) {
    throw new InvoiceLinesError(
      "invoice_mismatch",
      `Checkout lines add up to ${total} pence, not the group total of ${input.totalPence}`,
    );
  }
  return all;
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
      line_items: groupStripeLineItems(input, metadata),
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

  async checkoutStatus(sessionId: string): Promise<GroupCheckoutStatus> {
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

  async bankTransferInstructions(sessionId: string): Promise<BankTransferInstructions | null> {
    const stripe = this.stripeFactory.require();
    const session = await executeWithStripeRetries(() =>
      stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] }),
    );
    const intent = session.payment_intent;
    if (!intent || typeof intent === "string") return null;
    const shown = intent.next_action?.display_bank_transfer_instructions;
    const address = shown?.financial_addresses?.find((a) => a.sort_code);
    const sortCode = address?.sort_code;
    if (!shown || !sortCode || !shown.reference) return null;
    return {
      accountName: sortCode.account_holder_name,
      sortCode: sortCode.sort_code,
      accountNumber: sortCode.account_number,
      reference: shown.reference,
    };
  }

  async expireCheckout(sessionId: string): Promise<void> {
    const stripe = this.stripeFactory.require();
    try {
      await executeWithStripeRetries(() =>
        stripe.checkout.sessions.expire(sessionId, undefined, {
          idempotencyKey: `checkout:expire:group:${sessionId}`,
        }),
      );
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
