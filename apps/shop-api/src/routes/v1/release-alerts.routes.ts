import {
  ReleaseAlertConfirmBodySchema,
  ReleaseAlertConfirmResponseSchema,
  ReleaseAlertStatusSchema,
  ReleaseAlertSubscribeBodySchema,
  ReleaseAlertSubscribeResponseSchema,
  ReleaseAlertUnsubscribeBodySchema,
  ReleaseAlertUnsubscribePreviewSchema,
  ReleaseAlertUnsubscribeQuerySchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { EnquiryRateLimiter } from "../../application/enquiry-rate-limit.js";
import type { ReleaseAlertHandlers } from "../../application/handlers/release-alerts.handler.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { requireShopScope, requireShopSubject } from "../../plugins/shop-auth.js";
import { admissionClientIp } from "./enquiry-admission.js";

export type ReleaseAlertRoutesDeps = {
  releaseAlerts: ReleaseAlertHandlers;
  releaseAlertRateLimiter: EnquiryRateLimiter;
};

type SubscribeBody = { email?: string; source?: string; website?: string };

async function admit(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: ReleaseAlertRoutesDeps,
  senderKey: string,
): Promise<void> {
  let decision: Awaited<ReturnType<EnquiryRateLimiter["consume"]>>;
  try {
    decision = await deps.releaseAlertRateLimiter.consume({
      clientIp: admissionClientIp(request),
      senderKey,
    });
  } catch (error) {
    request.log.warn({ err: error }, "release_alert_rate_limit_unavailable");
    decision = { allowed: true };
  }
  if (decision.allowed) return;
  reply.header("retry-after", String(decision.retryAfterSeconds));
  throw new ShopApiError(
    SHOP_API_ERROR_CODES.RATE_LIMITED,
    "Too many release alert requests. Try again later.",
    429,
  );
}

/**
 * Release alerts. A visitor gives an address and confirms it from an email; the answer is the
 * same whether or not the address is already known, so the form cannot be used to find out who
 * is subscribed. A signed-in shopper is subscribed with the account's address. Confirming and
 * stopping use the token in an email as the credential, so they work without signing in.
 */
export async function registerReleaseAlertRoutes(
  app: FastifyInstance,
  deps: ReleaseAlertRoutesDeps,
) {
  app.post(
    "/v1/release-alerts",
    {
      schema: {
        tags: ["catalogue"],
        body: ReleaseAlertSubscribeBodySchema,
        response: {
          200: ReleaseAlertSubscribeResponseSchema,
          400: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
          429: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireShopScope(request, "shop.write");
      const body = request.body as SubscribeBody;
      // Bots that fill every field are told it worked and nothing is stored.
      if (body.website?.trim()) {
        request.log.info("release_alert_honeypot_rejected");
        return { status: "check_email" as const };
      }
      const auth = request.shopAuth;
      if (auth?.kind === "user") {
        await admit(request, reply, deps, `subject:${auth.subject}`);
        const result = await deps.releaseAlerts.subscribeAccount({
          identitySubjectId: auth.subject,
          source: body.source,
        });
        if (!result) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "Your account has no email address to send alerts to",
            409,
          );
        }
        return { status: "subscribed" as const };
      }
      const email = body.email?.trim();
      if (!email) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.VALIDATION,
          "An email address is required for alerts without signing in",
          400,
        );
      }
      await admit(request, reply, deps, `email:${email.toLowerCase()}`);
      return { status: await deps.releaseAlerts.subscribeGuest({ email, source: body.source }) };
    },
  );

  app.get(
    "/v1/me/release-alerts",
    {
      schema: {
        tags: ["catalogue"],
        response: {
          200: ReleaseAlertStatusSchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireShopScope(request, "shop.read");
      reply.header("cache-control", "no-store");
      return { subscribed: await deps.releaseAlerts.isSubscribed(requireShopSubject(request)) };
    },
  );

  app.delete(
    "/v1/me/release-alerts",
    {
      schema: {
        tags: ["catalogue"],
        response: {
          200: ReleaseAlertStatusSchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      await deps.releaseAlerts.stopAccount(requireShopSubject(request));
      return { subscribed: false };
    },
  );

  app.post(
    "/v1/release-alerts/confirm",
    {
      schema: {
        tags: ["catalogue"],
        body: ReleaseAlertConfirmBodySchema,
        response: {
          200: ReleaseAlertConfirmResponseSchema,
          400: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const { token } = request.body as { token: string };
      const outcome = await deps.releaseAlerts.confirm(token);
      if (outcome === "invalid") throw notFound("Release alert");
      return { outcome };
    },
  );

  app.get(
    "/v1/release-alerts/unsubscribe",
    {
      schema: {
        tags: ["catalogue"],
        querystring: ReleaseAlertUnsubscribeQuerySchema,
        response: {
          200: ReleaseAlertUnsubscribePreviewSchema,
          400: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      const { token } = request.query as { token: string };
      const preview = await deps.releaseAlerts.previewUnsubscribe(token);
      if (!preview) throw notFound("Release alert");
      reply.header("cache-control", "no-store");
      return preview;
    },
  );

  app.post(
    "/v1/release-alerts/unsubscribe",
    {
      schema: {
        tags: ["catalogue"],
        body: ReleaseAlertUnsubscribeBodySchema,
        response: {
          200: ReleaseAlertStatusSchema,
          400: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const { token } = request.body as { token: string };
      if (!(await deps.releaseAlerts.unsubscribe(token))) throw notFound("Release alert");
      return { subscribed: false };
    },
  );
}
