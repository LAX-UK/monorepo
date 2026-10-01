import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import Stripe from "stripe";
import type {
  HostedCheckoutLineItem,
  PaymentCheckoutGateway,
} from "../application/ports/commerce.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";

const SHOP_CHECKOUT_METADATA_APP = "shop";
function substituteOrderId(url: string, orderId: string): string {
  return url.replaceAll("{ORDER_ID}", orderId);
}

function stripeImageUrl(imageUrl: string | null | undefined): string[] | undefined {
  if (!imageUrl?.trim()) {
    return undefined;
  }
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== "https:") {
      return undefined;
    }
    return [parsed.toString()];
  } catch {
    return undefined;
  }
}

function buildStripeLineItems(input: {
  lines: HostedCheckoutLineItem[];
  fulfilmentSurchargePence: number;
  totalPence: number;
}): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.lines.map((line) => {
    const images = stripeImageUrl(line.imageUrl);
    const productData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData.ProductData = {
      name: line.title,
      description: line.description,
    };
    if (images) {
      productData.images = images;
    }
    return {
      quantity: line.quantity,
      price_data: {
        currency: "gbp",
        unit_amount: line.unitAmountPence,
        product_data: productData,
      },
    };
  });

  if (input.fulfilmentSurchargePence > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: input.fulfilmentSurchargePence,
        product_data: {
          name: "Delivery & fulfilment",
          description: "Insured delivery or collection handling",
        },
      },
    });
  }

  const sum = lineItems.reduce((acc, item) => {
    const unit = item.price_data?.unit_amount ?? 0;
    const qty = item.quantity ?? 1;
    return acc + unit * qty;
  }, 0);

  if (lineItems.length === 0 || sum !== input.totalPence) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.INTERNAL,
      "Checkout line items do not match order total",
      500,
    );
  }

  return lineItems;
}

export function createStripeShopCheckoutGateway(options: {
  secretKey: string | undefined;
  storefrontUrl: string;
  fakeCheckoutEnabled: boolean;
}): PaymentCheckoutGateway {
  const stripe = options.secretKey ? new Stripe(options.secretKey, { typescript: true }) : null;

  return {
    async createHostedCheckout(input) {
      if (!stripe) {
        if (!options.fakeCheckoutEnabled) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.PAYMENT_FAILED,
            "Stripe is not configured for checkout",
            503,
          );
        }
        const fakeSessionId = `fake_${input.orderId}`;
        return {
          checkoutUrl: `${options.storefrontUrl}/checkout/confirmation?orderId=${input.orderId}&session_id=${fakeSessionId}`,
          sessionId: fakeSessionId,
          paymentIntentId: null,
        };
      }
      const successUrl = substituteOrderId(input.successUrl, input.orderId);
      const cancelUrl = substituteOrderId(input.cancelUrl, input.orderId);
      const lineItems = buildStripeLineItems(input);
      const customerEmail = input.customerEmail?.trim();
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          success_url: successUrl,
          cancel_url: cancelUrl,
          expires_at: Math.floor(input.expiresAt.getTime() / 1000),
          locale: "en-GB",
          ...(customerEmail?.includes("@") ? { customer_email: customerEmail } : {}),
          line_items: lineItems,
          custom_text: {
            submit: {
              message:
                "Prints are reserved while you pay. Complete checkout within the session time limit.",
            },
          },
          metadata: {
            app: SHOP_CHECKOUT_METADATA_APP,
            orderId: input.orderId,
          },
          payment_intent_data: {
            metadata: {
              app: SHOP_CHECKOUT_METADATA_APP,
              orderId: input.orderId,
            },
            statement_descriptor_suffix: "LAX SHOP",
          },
        },
        { idempotencyKey: `checkout:shop-order:${input.orderId}` },
      );
      if (!session.url) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Stripe session missing url", 500);
      }
      return {
        checkoutUrl: session.url,
        sessionId: session.id,
        paymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
      };
    },
    async resolveHostedCheckout(input) {
      if (!stripe || input.sessionId.startsWith("fake_")) {
        return {
          checkoutUrl: `${options.storefrontUrl}/checkout/confirmation?orderId=${input.orderId}&session_id=${input.sessionId}`,
        };
      }
      const session = await stripe.checkout.sessions.retrieve(input.sessionId);
      if (session.url) {
        return { checkoutUrl: session.url };
      }
      if (session.status === "complete") {
        return {
          checkoutUrl: `${options.storefrontUrl}/checkout/confirmation?orderId=${input.orderId}&session_id=${input.sessionId}`,
        };
      }
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.CONFLICT,
        "Checkout session is no longer available",
        409,
      );
    },
    async expireHostedCheckout(input) {
      if (!stripe || input.sessionId.startsWith("fake_")) {
        return { kind: "not_expirable" as const };
      }
      const session = await stripe.checkout.sessions.retrieve(input.sessionId);
      if (session.status === "complete") {
        return { kind: "already_complete" as const };
      }
      if (session.status === "expired") {
        return { kind: "expired" as const };
      }
      await stripe.checkout.sessions.expire(input.sessionId);
      return { kind: "expired" as const };
    },
  };
}
