import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import Stripe from "stripe";
import type { PaymentCheckoutGateway } from "../application/ports/commerce.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";

const SHOP_CHECKOUT_METADATA_APP = "shop";

function substituteOrderId(url: string, orderId: string): string {
  return url.replaceAll("{ORDER_ID}", orderId);
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
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          success_url: successUrl,
          cancel_url: cancelUrl,
          expires_at: Math.floor(input.expiresAt.getTime() / 1000),
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "gbp",
                unit_amount: input.totalPence,
                product_data: { name: "LAX Shop print order" },
              },
            },
          ],
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
  };
}
