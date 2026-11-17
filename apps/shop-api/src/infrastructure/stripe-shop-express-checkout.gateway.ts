import { createHash } from "node:crypto";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type Stripe from "stripe";
import type {
  ExpressCheckoutGateway,
  ExpressCheckoutSnapshot,
  ExpressShippingRate,
} from "../application/ports/express-checkout.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import {
  SHOP_CHECKOUT_METADATA_APP,
  buildStripeLineItems,
  createShopCheckoutStripeClient,
} from "./stripe-shop-checkout.gateway.js";

/** `metadata.checkout` on an express session, so staff and the Shop can tell it from a hosted one. */
export const EXPRESS_CHECKOUT_METADATA_KIND = "express";

/** Express checkout delivers to the UK only; international delivery stays on the Details form. */
export const EXPRESS_ALLOWED_SHIPPING_COUNTRIES = ["GB"] as const;

function unavailable(): ShopApiError {
  return new ShopApiError(
    SHOP_API_ERROR_CODES.FEATURE_DISABLED,
    "Express checkout is not available",
    503,
  );
}

/** A short, stable digest of a request's parameters, so an idempotency key never meets new ones. */
function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
}

export function stripeShippingOptions(
  rates: readonly ExpressShippingRate[],
): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  return rates.map((rate) => ({
    shipping_rate_data: {
      type: "fixed_amount",
      display_name: rate.displayName,
      // Tax-inclusive, as the hosted page's delivery line is.
      fixed_amount: { amount: rate.amountPence, currency: "gbp" },
      metadata: { fulfilment: rate.id },
    },
  }));
}

export function expressCheckoutSnapshot(session: Stripe.Checkout.Session): ExpressCheckoutSnapshot {
  const metadata = session.metadata ?? {};
  return {
    sessionId: session.id,
    status: session.status ?? "open",
    isShopExpress:
      metadata.app === SHOP_CHECKOUT_METADATA_APP &&
      metadata.checkout === EXPRESS_CHECKOUT_METADATA_KIND &&
      session.ui_mode === "custom" &&
      session.mode === "payment",
    basketId: metadata.basketId?.trim() || null,
    orderId: metadata.orderId?.trim() || null,
    currency: session.currency ?? null,
    amountSubtotalPence: session.amount_subtotal ?? null,
  };
}

function isMissingResource(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "resource_missing"
  );
}

/**
 * Express checkout on Stripe's Checkout Sessions API in Elements mode (`ui_mode: "custom"`):
 * the same API, webhook and order reference as the hosted page, shown in the Shop's own page by
 * the Express Checkout Element. The session is opened for a basket with both UK rates and
 * shipping to GB only. Shipping details may be set only by the server, so the shopper cannot pay
 * until the Shop has made the order on confirm and bound it to the session.
 */
export function createStripeShopExpressCheckoutGateway(options: {
  secretKey: string | undefined;
  /** For tests; production builds the client from the secret key. */
  stripe?: Stripe | null;
}): ExpressCheckoutGateway {
  const stripe =
    options.stripe !== undefined
      ? options.stripe
      : createShopCheckoutStripeClient(options.secretKey);

  return {
    async createExpressCheckout(input) {
      if (!stripe) throw unavailable();
      const lineItems = buildStripeLineItems({
        lines: input.lines,
        fulfilmentSurchargePence: 0,
        totalPence: input.subtotalPence,
      });
      const customerEmail = input.customerEmail?.trim();
      const metadata = {
        app: SHOP_CHECKOUT_METADATA_APP,
        checkout: EXPRESS_CHECKOUT_METADATA_KIND,
        basketId: input.basketId,
      };
      const params: Stripe.Checkout.SessionCreateParams = {
        mode: "payment",
        ui_mode: "custom",
        return_url: input.returnUrl,
        expires_at: Math.floor(input.expiresAt.getTime() / 1000),
        ...(customerEmail?.includes("@") ? { customer_email: customerEmail } : {}),
        line_items: lineItems,
        shipping_address_collection: {
          allowed_countries: [...EXPRESS_ALLOWED_SHIPPING_COUNTRIES],
        },
        shipping_options: stripeShippingOptions(input.shippingRates),
        permissions: { update_shipping_details: "server_only" },
        metadata,
        payment_intent_data: {
          metadata,
          statement_descriptor_suffix: "LAX SHOP",
        },
      };
      // A key Stripe has seen only ever meets the same parameters: anything that changes (a
      // price, a title, the email) makes a new session instead of an idempotency error.
      const session = await stripe.checkout.sessions.create(params, {
        idempotencyKey: `${input.idempotencyKey}:${digest(params)}`,
      });
      if (!session.client_secret) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.INTERNAL,
          "Stripe session missing client secret",
          500,
        );
      }
      return {
        sessionId: session.id,
        clientSecret: session.client_secret,
        expiresAt: new Date(session.expires_at * 1000),
      };
    },

    async readExpressCheckout(input) {
      if (!stripe) throw unavailable();
      try {
        return expressCheckoutSnapshot(await stripe.checkout.sessions.retrieve(input.sessionId));
      } catch (error) {
        if (isMissingResource(error)) return null;
        throw error;
      }
    },

    async bindExpressCheckout(input) {
      if (!stripe) throw unavailable();
      const params: Stripe.Checkout.SessionUpdateParams = {
        metadata: {
          app: SHOP_CHECKOUT_METADATA_APP,
          checkout: EXPRESS_CHECKOUT_METADATA_KIND,
          basketId: input.basketId,
          orderId: input.orderId,
          ...(input.orderReference ? { orderReference: input.orderReference } : {}),
        },
        // The chosen rate becomes the only one, so the session's total is the order's.
        shipping_options: stripeShippingOptions([input.shippingRate]),
        collected_information: {
          shipping_details: {
            name: input.shipping.name,
            address: {
              line1: input.shipping.line1,
              ...(input.shipping.line2 ? { line2: input.shipping.line2 } : {}),
              city: input.shipping.city,
              postal_code: input.shipping.postcode,
              country: input.shipping.country,
            },
          },
        },
      };
      const session = await stripe.checkout.sessions.update(input.sessionId, params, {
        idempotencyKey: `${input.idempotencyKey}:${digest(params)}`,
      });
      return { amountTotalPence: session.amount_total ?? null };
    },
  };
}
