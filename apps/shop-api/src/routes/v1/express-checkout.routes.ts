import {
  type ExpressCheckoutConfirmRequest,
  ExpressCheckoutConfirmRequestSchema,
  ExpressCheckoutConfirmedSchema,
  ExpressCheckoutSessionSchema,
  type ExpressCheckoutStartRequest,
  ExpressCheckoutStartRequestSchema,
  type ExpressShippingAddressChangeRequest,
  ExpressShippingAddressChangeRequestSchema,
  ExpressShippingRatesSchema,
  type GuestExpressCheckoutConfirmRequest,
  GuestExpressCheckoutConfirmRequestSchema,
  GuestExpressCheckoutConfirmedSchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  ExpressCheckoutService,
  ExpressConfirmInput,
} from "../../application/express-checkout/express-checkout.service.js";
import type { BasketOwner, CheckoutOrderResult } from "../../application/ports/commerce.ports.js";
import type { ExpressShippingRate } from "../../application/ports/express-checkout.ports.js";
import type { CommerceRoutesDeps } from "../../commerce-route-deps.js";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { requireShopScope, requireShopSubject } from "../../plugins/shop-auth.js";
import { admissionClientIp } from "./enquiry-admission.js";
import {
  basketTokenHash,
  emailLogKey,
  requireGuestCheckout,
  requireStorefront,
  throwRefusal,
} from "./guest-checkout.routes.js";

const errors = {
  400: ShopApiErrorBodySchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: ShopApiErrorBodySchema,
  503: ShopApiErrorBodySchema,
};

function requireExpressCheckout(service: ExpressCheckoutService | undefined) {
  if (!service) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.FEATURE_DISABLED,
      "Express checkout is not available",
      404,
    );
  }
  return service;
}

function presentRates(rates: readonly ExpressShippingRate[]) {
  return rates.map((rate) => ({
    id: rate.id,
    displayName: rate.displayName,
    amountPence: rate.amountPence,
  }));
}

function presentSession(session: Awaited<ReturnType<ExpressCheckoutService["start"]>>) {
  return {
    sessionId: session.sessionId,
    clientSecret: session.clientSecret,
    expiresAt: session.expiresAt.toISOString(),
    currency: "gbp" as const,
    subtotalPence: session.subtotalPence,
    shippingRates: presentRates(session.shippingRates),
  };
}

function presentConfirmed(session: CheckoutOrderResult) {
  return {
    orderId: session.orderId,
    returnUrl: session.checkoutUrl,
    expiresAt: session.expiresAt.toISOString(),
  };
}

function confirmInput(
  owner: BasketOwner,
  body: ExpressCheckoutConfirmRequest | GuestExpressCheckoutConfirmRequest,
): ExpressConfirmInput {
  const name = body.name.trim();
  if (!name) throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Enter your name", 400);
  return {
    owner,
    basketId: body.basketId,
    sessionId: body.sessionId,
    shippingRateId: body.shippingRateId,
    name,
    phone: body.phone,
    shippingAddress: body.shippingAddress,
  };
}

function guestOwner(request: FastifyRequest): BasketOwner {
  return { kind: "anonymous", tokenHash: basketTokenHash(request) };
}

/**
 * GAP-49 express checkout for signed-in shoppers (`/v1/orders/express-checkout`) and guests
 * (`/v1/guest-checkout/express-checkout`, storefront only, with the basket token). Each has three
 * steps: open the session for the basket, the wallet sheet's address change, and confirm, which
 * makes the order and holds its prints. Every route refuses while SHOP_EXPRESS_CHECKOUT is off.
 */
export async function registerExpressCheckoutRoutes(
  app: FastifyInstance,
  deps: CommerceRoutesDeps,
) {
  app.post(
    "/v1/orders/express-checkout",
    {
      schema: {
        tags: ["commerce"],
        body: ExpressCheckoutStartRequestSchema,
        response: { 200: ExpressCheckoutSessionSchema, ...errors },
      },
    },
    async (request) => {
      const service = requireExpressCheckout(deps.expressCheckout);
      requireShopScope(request, "shop.write");
      const subject = requireShopSubject(request);
      const body = request.body as ExpressCheckoutStartRequest;
      return presentSession(
        await service.start({
          owner: { kind: "subject", identitySubjectId: subject },
          basketId: body.basketId,
        }),
      );
    },
  );

  app.post(
    "/v1/orders/express-checkout/shipping-address",
    {
      schema: {
        tags: ["commerce"],
        body: ExpressShippingAddressChangeRequestSchema,
        response: { 200: ExpressShippingRatesSchema, ...errors },
      },
    },
    async (request) => {
      const service = requireExpressCheckout(deps.expressCheckout);
      requireShopScope(request, "shop.write");
      const subject = requireShopSubject(request);
      const body = request.body as ExpressShippingAddressChangeRequest;
      const rates = await service.changeShippingAddress({
        owner: { kind: "subject", identitySubjectId: subject },
        basketId: body.basketId,
        sessionId: body.sessionId,
        address: body.address,
      });
      return { shippingRates: presentRates(rates) };
    },
  );

  app.post(
    "/v1/orders/express-checkout/confirm",
    {
      schema: {
        tags: ["commerce"],
        body: ExpressCheckoutConfirmRequestSchema,
        response: { 200: ExpressCheckoutConfirmedSchema, ...errors },
      },
    },
    async (request) => {
      const service = requireExpressCheckout(deps.expressCheckout);
      requireShopScope(request, "shop.write");
      const subject = requireShopSubject(request);
      const body = request.body as ExpressCheckoutConfirmRequest;
      const session = await service.confirm(
        confirmInput({ kind: "subject", identitySubjectId: subject }, body),
        (order) => deps.checkoutOrder({ ...order, subject }),
      );
      request.log.info(
        { orderId: session.orderId, rate: body.shippingRateId },
        "shop_express_checkout_confirmed",
      );
      return presentConfirmed(session);
    },
  );

  app.post(
    "/v1/guest-checkout/express-checkout",
    {
      schema: {
        tags: ["commerce"],
        body: ExpressCheckoutStartRequestSchema,
        response: { 200: ExpressCheckoutSessionSchema, ...errors },
      },
    },
    async (request) => {
      const service = requireExpressCheckout(deps.expressCheckout);
      requireStorefront(request, "shop.write");
      requireGuestCheckout(deps.guestCheckout);
      const body = request.body as ExpressCheckoutStartRequest;
      return presentSession(
        await service.start({ owner: guestOwner(request), basketId: body.basketId }),
      );
    },
  );

  app.post(
    "/v1/guest-checkout/express-checkout/shipping-address",
    {
      schema: {
        tags: ["commerce"],
        body: ExpressShippingAddressChangeRequestSchema,
        response: { 200: ExpressShippingRatesSchema, ...errors },
      },
    },
    async (request) => {
      const service = requireExpressCheckout(deps.expressCheckout);
      requireStorefront(request, "shop.write");
      requireGuestCheckout(deps.guestCheckout);
      const body = request.body as ExpressShippingAddressChangeRequest;
      const rates = await service.changeShippingAddress({
        owner: guestOwner(request),
        basketId: body.basketId,
        sessionId: body.sessionId,
        address: body.address,
      });
      return { shippingRates: presentRates(rates) };
    },
  );

  app.post(
    "/v1/guest-checkout/express-checkout/confirm",
    {
      schema: {
        tags: ["commerce"],
        body: GuestExpressCheckoutConfirmRequestSchema,
        response: {
          200: GuestExpressCheckoutConfirmedSchema,
          ...errors,
          429: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      const service = requireExpressCheckout(deps.expressCheckout);
      requireStorefront(request, "shop.write");
      const guest = requireGuestCheckout(deps.guestCheckout);
      const body = request.body as GuestExpressCheckoutConfirmRequest;
      const input = confirmInput(guestOwner(request), body);
      const result = await service.confirm(input, (order) =>
        guest.service.placeOrder({
          ...order,
          email: body.email,
          name: input.name,
          ...(order.deliveryPhone ? { phone: order.deliveryPhone } : {}),
          marketingConsent: body.marketingConsent === true,
          basketTokenHash: basketTokenHash(request),
          clientIp: admissionClientIp(request),
        }),
      );
      request.log.info(
        { emailKey: emailLogKey(body.email), outcome: result.kind, rate: body.shippingRateId },
        "guest_express_checkout_confirmed",
      );
      if (result.kind !== "created") return throwRefusal(reply, result);
      return {
        ...presentConfirmed(result.session),
        orderAccessToken: result.access.token,
        orderAccessExpiresAt: result.access.expiresAt.toISOString(),
      };
    },
  );
}
