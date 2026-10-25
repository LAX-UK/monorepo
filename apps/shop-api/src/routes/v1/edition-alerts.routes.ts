import {
  EditionAlertCancelResponseSchema,
  EditionAlertIdParamsSchema,
  EditionAlertListSchema,
  EditionAlertUnsubscribeBodySchema,
  EditionAlertUnsubscribePreviewSchema,
  EditionAlertUnsubscribeQuerySchema,
  EditionAlertUnsubscribeResponseSchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { EnquiryRateLimiter } from "../../application/enquiry-rate-limit.js";
import type {
  EditionAlertHandlers,
  RegisterEditionAlertResult,
} from "../../application/handlers/edition-alerts.handler.js";
import type { EditionAlertRecipient } from "../../application/ports/edition-alert.store.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { requireShopScope, requireShopSubject } from "../../plugins/shop-auth.js";
import { admissionClientIp } from "./enquiry-admission.js";

export type EditionAlertRoutesDeps = {
  editionAlerts: EditionAlertHandlers;
  editionAlertRateLimiter: EnquiryRateLimiter;
};

/**
 * Registers an edition alert from `POST /v1/artworks/:slug/interest` with intent `notify_me`.
 * Guests give an email address; signed-in shoppers use their account's. The honeypot and rate
 * limits match enquiries. A guest always hears "registered", so the form cannot be used to find
 * out which addresses already have alerts.
 */
export async function registerEditionAlertFromRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: EditionAlertRoutesDeps,
  input: { artworkSlug: string; email?: string | undefined; website?: string | undefined },
): Promise<"registered" | "already_subscribed"> {
  requireShopScope(request, "shop.write");
  if (input.website?.trim()) {
    request.log.info("edition_alert_honeypot_rejected");
    return "registered";
  }
  const auth = request.shopAuth;
  let recipient: EditionAlertRecipient;
  if (auth?.kind === "user") {
    recipient = { kind: "account", identitySubjectId: auth.subject };
  } else {
    const email = input.email?.trim();
    if (!email) {
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.VALIDATION,
        "An email address is required for an alert without signing in",
        400,
      );
    }
    recipient = { kind: "guest", email };
  }

  let decision: Awaited<ReturnType<EnquiryRateLimiter["consume"]>>;
  try {
    decision = await deps.editionAlertRateLimiter.consume({
      clientIp: admissionClientIp(request),
      senderKey:
        recipient.kind === "guest"
          ? `email:${recipient.email.toLowerCase()}`
          : `subject:${recipient.identitySubjectId}`,
    });
  } catch (error) {
    request.log.warn({ err: error }, "edition_alert_rate_limit_unavailable");
    decision = { allowed: true };
  }
  if (!decision.allowed) {
    reply.header("retry-after", String(decision.retryAfterSeconds));
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.RATE_LIMITED,
      "Too many alert requests. Try again later.",
      429,
    );
  }

  const result: RegisterEditionAlertResult = await deps.editionAlerts.register({
    artworkSlug: input.artworkSlug,
    recipient,
  });
  if (result === "artwork_not_found") throw notFound("Artwork");
  if (result === "not_subscribable") {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.CONFLICT,
      "This artwork is not accepting availability notifications",
      409,
    );
  }
  return recipient.kind === "guest" ? "registered" : result;
}

export async function registerEditionAlertRoutes(
  app: FastifyInstance,
  deps: EditionAlertRoutesDeps,
) {
  app.get(
    "/v1/me/alerts",
    {
      schema: {
        tags: ["catalogue"],
        response: {
          200: EditionAlertListSchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const alerts = await deps.editionAlerts.listForSubject(requireShopSubject(request));
      return {
        items: alerts.map((alert) => ({ ...alert, createdAt: alert.createdAt.toISOString() })),
      };
    },
  );

  app.delete(
    "/v1/me/alerts/:alertId",
    {
      schema: {
        tags: ["catalogue"],
        params: EditionAlertIdParamsSchema,
        response: {
          200: EditionAlertCancelResponseSchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const { alertId } = request.params as { alertId: string };
      const result = await deps.editionAlerts.cancelForSubject({
        identitySubjectId: requireShopSubject(request),
        target: { alertId },
      });
      if (result === "not_found") throw notFound("Alert");
      return { status: result };
    },
  );

  app.delete(
    "/v1/me/alerts/artworks/:slug",
    {
      schema: {
        tags: ["catalogue"],
        params: {
          type: "object",
          properties: { slug: { type: "string", minLength: 1, maxLength: 200 } },
          required: ["slug"],
        },
        response: {
          200: EditionAlertCancelResponseSchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const { slug } = request.params as { slug: string };
      const result = await deps.editionAlerts.cancelForSubject({
        identitySubjectId: requireShopSubject(request),
        target: { artworkSlug: slug },
      });
      return { status: result === "cancelled" ? "cancelled" : "already_stopped" };
    },
  );

  // The token in an alert email is the credential, so these work without signing in.
  app.get(
    "/v1/alerts/unsubscribe",
    {
      schema: {
        tags: ["catalogue"],
        querystring: EditionAlertUnsubscribeQuerySchema,
        response: {
          200: EditionAlertUnsubscribePreviewSchema,
          400: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      const { token } = request.query as { token: string };
      const preview = await deps.editionAlerts.previewUnsubscribe(token);
      if (!preview) throw notFound("Alert");
      reply.header("cache-control", "no-store");
      return preview;
    },
  );

  app.post(
    "/v1/alerts/unsubscribe",
    {
      schema: {
        tags: ["catalogue"],
        body: EditionAlertUnsubscribeBodySchema,
        response: {
          200: EditionAlertUnsubscribeResponseSchema,
          400: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const { token } = request.body as { token: string };
      const result = await deps.editionAlerts.unsubscribe(token);
      if (!result) throw notFound("Alert");
      return result;
    },
  );
}
