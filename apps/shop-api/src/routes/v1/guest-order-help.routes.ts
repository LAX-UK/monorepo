import {
  CheckoutSessionSchema,
  type OrderProblemReason,
  OrderProblemReportRequestSchema,
  OrderProblemReportResponseSchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { normaliseGuestEmail, orderProblemWindow } from "@auction/shop-domain";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { GuestOrderLinkResolution } from "../../application/ports/guest-checkout.ports.js";
import type { CommerceRoutesDeps, GuestCheckoutRoutesDeps } from "../../commerce-route-deps.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { requireShopScope } from "../../plugins/shop-auth.js";
import { presentCheckoutSession } from "../../presenters/commerce.presenter.js";
import { admissionClientIp } from "./enquiry-admission.js";

const TokenSchema = Type.String({ minLength: 1, maxLength: 128 });

/** Guest routes are the storefront's own: only the BFF token reaches them. */
function requireStorefront(request: FastifyRequest): void {
  requireShopScope(request, "shop.write");
  if (request.shopAuth?.kind !== "bff") {
    throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Guest checkout only", 403);
  }
}

async function validGuestOrder(
  deps: GuestCheckoutRoutesDeps | undefined,
  token: string,
): Promise<
  { deps: GuestCheckoutRoutesDeps } & Extract<GuestOrderLinkResolution, { kind: "valid" }>
> {
  if (!deps) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.FEATURE_DISABLED, "Not available", 503);
  }
  const resolved = await deps.links.resolve(token, new Date());
  if (resolved.kind !== "valid") throw notFound("Order");
  return { deps, ...resolved };
}

/**
 * Help with a guest order, the same as an account gets: "Report a problem" reaches the same staff
 * inbox and emails, and an unpaid order still being held can go back to secure payment. Both are
 * reached through the order's link token, so a guest never needs an account to get help.
 */
export async function registerGuestOrderHelpRoutes(
  app: FastifyInstance,
  guestDeps: GuestCheckoutRoutesDeps | undefined,
  orderProblems: CommerceRoutesDeps["orderProblems"],
) {
  app.post(
    "/v1/guest-orders/problem-reports",
    {
      schema: {
        tags: ["commerce"],
        body: Type.Object(
          {
            token: TokenSchema,
            reason: OrderProblemReportRequestSchema.properties.reason,
            details: OrderProblemReportRequestSchema.properties.details,
          },
          { additionalProperties: false },
        ),
        response: {
          201: OrderProblemReportResponseSchema,
          400: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
          429: ShopApiErrorBodySchema,
          503: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireStorefront(request);
      if (!orderProblems) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.FEATURE_DISABLED,
          "Problem reports are not available",
          503,
        );
      }
      const body = request.body as { token: string; reason: OrderProblemReason; details: string };
      const details = body.details.trim();
      if (!details) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Tell us what happened", 400);
      }
      const { deps, order, subject, email } = await validGuestOrder(guestDeps, body.token);
      const window = orderProblemWindow({
        status: order.status,
        paidAt: order.paidAt,
        refundPeriodEndsAt: order.refundPeriodEndsAt,
        possessionAt: order.progress?.possessionAt ?? null,
        now: new Date(),
      });
      if (!window.open) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.CONFLICT,
          "This order can no longer be reported here",
          409,
        );
      }
      const decision = await orderProblems.rateLimiter
        .consume({
          clientIp: admissionClientIp(request),
          senderKey: `email:${normaliseGuestEmail(email)}`,
        })
        .catch(() => ({ allowed: true as const }));
      if (!decision.allowed) {
        reply.header("retry-after", String(decision.retryAfterSeconds));
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.RATE_LIMITED,
          "Too many messages. Try again later.",
          429,
        );
      }
      const contact = await deps.getCustomerProfile(subject);
      const result = await orderProblems.writer.submit({
        sender: { kind: "guest", contactName: contact.name ?? email, contactEmail: email },
        orderReference: order.reference,
        reason: body.reason,
        details,
      });
      return reply.status(201).send(result);
    },
  );

  app.post(
    "/v1/guest-orders/resume-checkout",
    {
      schema: {
        tags: ["commerce"],
        body: Type.Object({
          token: TokenSchema,
          successUrl: Type.String({ minLength: 1 }),
          cancelUrl: Type.String({ minLength: 1 }),
        }),
        response: {
          200: CheckoutSessionSchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireStorefront(request);
      const body = request.body as { token: string; successUrl: string; cancelUrl: string };
      const { deps, order, subject } = await validGuestOrder(guestDeps, body.token);
      // The same checks as for an account: still unpaid, still held, redirects on the storefront.
      const session = await deps.resumeCheckout({
        subject,
        orderId: order.orderId,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
      });
      return presentCheckoutSession(session);
    },
  );
}
