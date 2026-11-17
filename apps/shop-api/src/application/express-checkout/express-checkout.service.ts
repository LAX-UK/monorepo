import {
  EXPRESS_CHECKOUT_SOLD_OUT_MESSAGE,
  type ExpressShippingRateId,
  SHOP_API_ERROR_CODES,
  type ShopDeliveryAddress,
} from "@auction/shop-contracts";
import { CHECKOUT_HOLD_MS } from "@auction/shop-domain";
import { ShopApiError } from "../../errors/shop-api-error.js";
import type {
  BasketOwner,
  CheckoutOrderInput,
  ExpressShippingDetails,
} from "../ports/commerce.ports.js";
import type {
  ExpressCheckoutBasketReader,
  ExpressCheckoutGateway,
  ExpressShippingRate,
} from "../ports/express-checkout.ports.js";
import {
  EXPRESS_SHIPPING_RATES,
  EXPRESS_UK_ONLY_MESSAGE,
  expressShippingRate,
  expressShippingRatesForAddress,
  ukCountryCode,
} from "./express-shipping-rates.js";

/**
 * Repeat starts for an unchanged basket inside one window reuse the same Stripe session. Stripe
 * keeps an idempotency key for a day, so the key carries the window and never hands back a session
 * that has already expired; the session's expiry is fixed by the window too, so the repeated
 * request is the same request.
 */
export const EXPRESS_SESSION_REUSE_WINDOW_MS = 10 * 60 * 1000;

/** The order fields an express confirm supplies; the caller adds who the order is for. */
export type ExpressOrderFields = Omit<CheckoutOrderInput, "subject" | "guest" | "outsideUk"> & {
  express: NonNullable<CheckoutOrderInput["express"]>;
};

export type ExpressConfirmInput = {
  owner: BasketOwner;
  basketId: string;
  sessionId: string;
  shippingRateId: ExpressShippingRateId;
  name: string;
  phone?: string | undefined;
  shippingAddress: ShopDeliveryAddress;
};

export type ExpressCheckoutServiceDeps = {
  baskets: ExpressCheckoutBasketReader;
  gateway: ExpressCheckoutGateway;
  storefrontUrl: string;
  /** The signed-in shopper's email, so the wallet receipt goes to it; absent for guests. */
  customerEmail?: (subject: string) => Promise<string | null>;
  now?: () => Date;
};

function ownedBy(expected: BasketOwner) {
  return (owner: BasketOwner) =>
    expected.kind === "subject"
      ? owner.kind === "subject" && owner.identitySubjectId === expected.identitySubjectId
      : owner.kind === "anonymous" && owner.tokenHash === expected.tokenHash;
}

function conflict(message: string): ShopApiError {
  return new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, message, 409);
}

/**
 * GAP-49 express checkout. `start` opens an Elements-mode Checkout Session for the basket;
 * `changeShippingAddress` is the wallet sheet's address change handler; `confirm` makes the order
 * and holds its prints, only when the shopper confirms in the sheet, through the same order writer
 * as the Details form (signed-in or guest), and binds the order to the session.
 */
export function createExpressCheckoutService(deps: ExpressCheckoutServiceDeps) {
  const now = deps.now ?? (() => new Date());
  const storefront = deps.storefrontUrl.replace(/\/+$/, "");

  /** The session must be one the Shop opened for this basket, and still open. */
  async function assertOpenSessionForBasket(sessionId: string, basketId: string): Promise<void> {
    const snapshot = await deps.gateway.readExpressCheckout({ sessionId });
    if (!snapshot?.isShopExpress || snapshot.basketId !== basketId) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Express checkout not found", 404);
    }
    if (snapshot.status !== "open") {
      throw conflict("This payment has ended. Start again from your basket.");
    }
  }

  function shippingDetails(input: ExpressConfirmInput): ExpressShippingDetails {
    const address = input.shippingAddress;
    const country = ukCountryCode(address.country);
    if (!country) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, EXPRESS_UK_ONLY_MESSAGE, 400);
    }
    const name = (address.recipientName ?? input.name).trim();
    const line1 = address.line1.trim();
    const city = address.city.trim();
    const postcode = address.postcode.trim();
    if (!name || !line1 || !city || !postcode) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Delivery address is required", 400);
    }
    const line2 = address.line2?.trim();
    return { name, line1, ...(line2 ? { line2 } : {}), city, postcode, country };
  }

  return {
    shippingRates: EXPRESS_SHIPPING_RATES,

    async start(input: { owner: BasketOwner; basketId: string }): Promise<{
      sessionId: string;
      clientSecret: string;
      expiresAt: Date;
      subtotalPence: number;
      shippingRates: readonly ExpressShippingRate[];
    }> {
      const basket = await deps.baskets.loadExpressBasket({
        basketId: input.basketId,
        ownedBy: ownedBy(input.owner),
      });
      const window = Math.floor(now().getTime() / EXPRESS_SESSION_REUSE_WINDOW_MS);
      // Fixed for the window, so a repeated request sends Stripe the same parameters.
      const windowEnd = (window + 1) * EXPRESS_SESSION_REUSE_WINDOW_MS;
      const customerEmail =
        input.owner.kind === "subject" && deps.customerEmail
          ? await deps.customerEmail(input.owner.identitySubjectId)
          : null;
      const key = `checkout:shop-express:${input.basketId}:${basket.contentKey}:${window}`;
      const open = (idempotencyKey: string) =>
        deps.gateway.createExpressCheckout({
          basketId: input.basketId,
          idempotencyKey,
          lines: basket.lines,
          subtotalPence: basket.subtotalPence,
          shippingRates: EXPRESS_SHIPPING_RATES,
          returnUrl: `${storefront}/checkout/confirmation?session_id={CHECKOUT_SESSION_ID}`,
          // At least Stripe's shortest session from now (31 to 41 minutes); no print is held
          // while it is open.
          expiresAt: new Date(windowEnd + CHECKOUT_HOLD_MS),
          customerEmail,
        });
      let session = await open(key);
      // Stripe answers a repeated key with the session it first made, which may have ended since
      // (a confirm that was refused releases its order and ends the session). Then a new one,
      // keyed by the one that ended, so a repeat of this request reuses that instead.
      const current = await deps.gateway.readExpressCheckout({ sessionId: session.sessionId });
      if (current?.status !== "open" || current.orderId) {
        session = await open(`${key}:after:${session.sessionId}`);
      }
      return {
        ...session,
        subtotalPence: basket.subtotalPence,
        shippingRates: EXPRESS_SHIPPING_RATES,
      };
    },

    async changeShippingAddress(input: {
      owner: BasketOwner;
      basketId: string;
      sessionId: string;
      address: { country: string };
    }): Promise<readonly ExpressShippingRate[]> {
      // The country is checked first: it needs no lookups and is the usual reason to refuse.
      const rates = expressShippingRatesForAddress(input.address);
      await deps.baskets.assertBasketOwned({
        basketId: input.basketId,
        ownedBy: ownedBy(input.owner),
      });
      await assertOpenSessionForBasket(input.sessionId, input.basketId);
      return rates;
    },

    /**
     * The order fields for a confirm, checked; then `place` makes the order (the signed-in or
     * guest writer). A print that sold while the sheet was open fails the confirm with the
     * message the sheet shows.
     */
    async confirm<T>(
      input: ExpressConfirmInput,
      place: (order: ExpressOrderFields) => Promise<T>,
    ): Promise<T> {
      const rate = expressShippingRate(input.shippingRateId);
      const shipping = shippingDetails(input);
      const phone = input.phone?.trim();
      const delivering = rate.id === "uk_insured_delivery";
      if (delivering && !phone) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.VALIDATION,
          "Delivery phone is required with a delivery address",
          400,
        );
      }
      const order: ExpressOrderFields = {
        basketId: input.basketId,
        fulfilment: rate.id,
        // One order per session: a repeated confirm (a retry, or a second try after a declined
        // card) returns to the same order and hold.
        idempotencyKey: `express:${input.sessionId}`,
        successUrl: `${storefront}/checkout/confirmation?orderId={ORDER_ID}`,
        cancelUrl: `${storefront}/basket`,
        ...(delivering
          ? {
              deliveryAddress: {
                recipientName: shipping.name,
                line1: shipping.line1,
                ...(shipping.line2 ? { line2: shipping.line2 } : {}),
                city: shipping.city,
                postcode: shipping.postcode,
                country: shipping.country,
              },
            }
          : {}),
        ...(phone ? { deliveryPhone: phone } : {}),
        express: { sessionId: input.sessionId, shipping },
      };
      try {
        return await place(order);
      } catch (error) {
        if (error instanceof ShopApiError && error.code === SHOP_API_ERROR_CODES.OUT_OF_STOCK) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.OUT_OF_STOCK,
            EXPRESS_CHECKOUT_SOLD_OUT_MESSAGE,
            409,
          );
        }
        throw error;
      }
    },
  };
}

export type ExpressCheckoutService = ReturnType<typeof createExpressCheckoutService>;
