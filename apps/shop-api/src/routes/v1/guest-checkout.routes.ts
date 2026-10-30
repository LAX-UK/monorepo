import { createHash } from "node:crypto";
import {
  type GuestCheckoutRequest,
  GuestCheckoutRequestSchema,
  GuestCheckoutSessionSchema,
  type GuestEmailCheckRequest,
  GuestEmailCheckRequestSchema,
  GuestEmailCheckResponseSchema,
  GuestOrderLinkRequestSchema,
  type GuestOrderLinkResendRequest,
  GuestOrderLinkResendRequestSchema,
  GuestOrderViewSchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { isPlausibleGuestEmail, normaliseGuestEmail } from "@auction/shop-domain";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { GuestCheckoutRefusal } from "../../application/guest-checkout/guest-checkout.service.js";
import { buildOrderInvoiceModel, renderOrderInvoicePdf } from "../../application/order-invoice.js";
import type { GuestCheckoutRoutesDeps } from "../../commerce-route-deps.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { requireShopScope } from "../../plugins/shop-auth.js";
import { presentCheckoutSession, presentOrder } from "../../presenters/commerce.presenter.js";
import { admissionClientIp } from "./enquiry-admission.js";

const BASKET_TOKEN_HEADER = "x-shop-basket-token";

/** Guest routes are the storefront's own: only the BFF token reaches them, never a user token. */
function requireStorefront(request: FastifyRequest, scope: "shop.read" | "shop.write"): void {
  requireShopScope(request, scope);
  if (request.shopAuth?.kind !== "bff") {
    throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Guest checkout only", 403);
  }
}

function requireGuestCheckout(deps: GuestCheckoutRoutesDeps | undefined): GuestCheckoutRoutesDeps {
  if (!deps) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.FEATURE_DISABLED,
      "Guest checkout is not available",
      503,
    );
  }
  return deps;
}

function basketTokenHash(request: FastifyRequest): string {
  const raw = request.headers[BASKET_TOKEN_HEADER];
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) throw notFound("Basket");
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** A short, non-reversible label for logs: enough to follow one address, not to read it. */
function emailLogKey(email: string): string {
  return createHash("sha256").update(normaliseGuestEmail(email)).digest("hex").slice(0, 16);
}

function throwRefusal(reply: FastifyReply, refusal: GuestCheckoutRefusal): never {
  switch (refusal.kind) {
    case "invalid_email":
      throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Enter a valid email address", 400);
    case "rate_limited":
      reply.header("retry-after", String(refusal.retryAfterSeconds));
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.RATE_LIMITED,
        "Too many attempts. Try again later.",
        429,
      );
    case "unavailable":
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.FEATURE_DISABLED,
        "Guest checkout is not available right now",
        503,
      );
    case "sign_in_required":
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.ACCOUNT_EXISTS,
        "This email has a LAX account. Sign in to continue.",
        409,
      );
  }
}

export async function registerGuestCheckoutRoutes(
  app: FastifyInstance,
  guestDeps: GuestCheckoutRoutesDeps | undefined,
) {
  app.post(
    "/v1/guest-checkout/email-checks",
    {
      schema: {
        tags: ["commerce"],
        body: GuestEmailCheckRequestSchema,
        response: {
          200: GuestEmailCheckResponseSchema,
          400: ShopApiErrorBodySchema,
          429: ShopApiErrorBodySchema,
          503: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireStorefront(request, "shop.write");
      const deps = requireGuestCheckout(guestDeps);
      const body = request.body as GuestEmailCheckRequest;
      if (body.website?.trim()) {
        // A bot filled the hidden field: it gets an ordinary answer and nothing is stored.
        request.log.info("guest_email_check_honeypot");
        return { outcome: "continue_as_guest" as const };
      }
      const result = await deps.service.checkEmail({
        email: body.email,
        marketingConsent: body.marketingConsent === true,
        clientIp: admissionClientIp(request),
      });
      request.log.info(
        { emailKey: emailLogKey(body.email), outcome: result.kind },
        "guest_email_check",
      );
      if (result.kind === "continue_as_guest" || result.kind === "sign_in_required") {
        return { outcome: result.kind };
      }
      return throwRefusal(reply, result);
    },
  );

  app.post(
    "/v1/guest-checkout/orders",
    {
      schema: {
        tags: ["commerce"],
        body: GuestCheckoutRequestSchema,
        response: {
          200: GuestCheckoutSessionSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
          429: ShopApiErrorBodySchema,
          503: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireStorefront(request, "shop.write");
      const deps = requireGuestCheckout(guestDeps);
      const body = request.body as GuestCheckoutRequest;
      const name = body.name.trim();
      if (!name) throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Enter your name", 400);
      const deliveryPhone = body.deliveryPhone?.trim();
      if (body.deliveryAddress && !deliveryPhone) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.VALIDATION,
          "Delivery phone is required with a delivery address",
          400,
        );
      }
      const result = await deps.service.placeOrder({
        basketId: body.basketId,
        fulfilment: body.fulfilment,
        idempotencyKey: body.idempotencyKey,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        ...(body.deliveryAddress ? { deliveryAddress: body.deliveryAddress } : {}),
        ...(deliveryPhone ? { deliveryPhone, phone: deliveryPhone } : {}),
        email: body.email,
        name,
        marketingConsent: body.marketingConsent === true,
        basketTokenHash: basketTokenHash(request),
        clientIp: admissionClientIp(request),
      });
      request.log.info(
        { emailKey: emailLogKey(body.email), outcome: result.kind },
        "guest_checkout_order",
      );
      if (result.kind !== "created") return throwRefusal(reply, result);
      return {
        ...presentCheckoutSession(result.session),
        orderAccessToken: result.access.token,
        orderAccessExpiresAt: result.access.expiresAt.toISOString(),
      };
    },
  );

  app.post(
    "/v1/guest-orders/open",
    {
      schema: {
        tags: ["commerce"],
        body: GuestOrderLinkRequestSchema,
        response: { 200: GuestOrderViewSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireStorefront(request, "shop.read");
      const deps = requireGuestCheckout(guestDeps);
      const { token } = request.body as { token: string };
      const resolved = await deps.links.resolve(token, new Date());
      if (resolved.kind === "not_found") throw notFound("Order");
      if (resolved.kind !== "valid") {
        return { state: resolved.kind, orderReference: resolved.orderReference };
      }
      return {
        state: "valid" as const,
        order: presentOrder(resolved.order),
        email: resolved.email,
        linkExpiresAt: resolved.expiresAt.toISOString(),
      };
    },
  );

  app.post(
    "/v1/guest-orders/invoice",
    {
      schema: {
        tags: ["commerce"],
        body: GuestOrderLinkRequestSchema,
        response: { 404: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireStorefront(request, "shop.read");
      const deps = requireGuestCheckout(guestDeps);
      const { token } = request.body as { token: string };
      const resolved = await deps.links.resolve(token, new Date());
      // Same VAT invoice as an account order; an unpaid order answers as if it had none.
      if (resolved.kind !== "valid" || !resolved.order.paidAt || !resolved.order.invoiceNumber) {
        throw notFound("Invoice");
      }
      const model = buildOrderInvoiceModel({
        order: resolved.order,
        customer: await deps.getCustomerProfile(resolved.subject),
        supplier: deps.invoiceIssuer.supplier,
        vatNumber: deps.invoiceIssuer.vatNumber,
      });
      const pdf = await renderOrderInvoicePdf(model);
      return reply
        .header("content-type", "application/pdf")
        .header("content-disposition", `attachment; filename="${model.fileName}"`)
        .header("cache-control", "private, no-store")
        .send(pdf);
    },
  );

  app.post(
    "/v1/guest-orders/links",
    {
      schema: {
        tags: ["commerce"],
        body: GuestOrderLinkResendRequestSchema,
        response: {
          202: Type.Object({ accepted: Type.Literal(true) }),
          400: ShopApiErrorBodySchema,
          429: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireStorefront(request, "shop.write");
      const deps = requireGuestCheckout(guestDeps);
      const body = request.body as GuestOrderLinkResendRequest;
      if (!isPlausibleGuestEmail(body.email)) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Enter a valid email address", 400);
      }
      const email = normaliseGuestEmail(body.email);
      const decision = await deps.linkRateLimiter
        .consume({ clientIp: admissionClientIp(request), senderKey: `email:${email}` })
        .catch(() => ({ allowed: true as const }));
      if (!decision.allowed) {
        return throwRefusal(reply, {
          kind: "rate_limited",
          retryAfterSeconds: decision.retryAfterSeconds,
        });
      }
      await deps.links.resend({ email, orderReference: body.orderReference, now: new Date() });
      return reply.status(202).send({ accepted: true as const });
    },
  );
}
