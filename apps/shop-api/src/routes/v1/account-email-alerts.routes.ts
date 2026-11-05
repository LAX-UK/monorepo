import {
  AccountEmailAlertRefusalSchema,
  AccountEmailAlertSavedSchema,
  AccountEmailAlertSwitchBodySchema,
  type AccountEmailAlertTopic,
  AccountEmailAlertTopicParamsSchema,
  AccountEmailAlertsSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type { AccountEmailAlertHandlers } from "../../application/handlers/account-email-alerts.handler.js";
import { requireAnyShopScope, requireShopSubject } from "../../plugins/shop-auth.js";

export type AccountEmailAlertRoutesDeps = {
  accountEmailAlerts: AccountEmailAlertHandlers;
};

/**
 * The person's own alert switches, for the Email alerts page in LAX Account. LAX Account reaches
 * them with its narrow alert scopes; the storefronts with their usual ones. Every answer is about
 * the caller alone.
 */
export async function registerAccountEmailAlertRoutes(
  app: FastifyInstance,
  deps: AccountEmailAlertRoutesDeps,
) {
  app.get(
    "/v1/me/email-alerts",
    {
      schema: {
        tags: ["catalogue"],
        response: {
          200: AccountEmailAlertsSchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireAnyShopScope(request, ["shop.read", "lax.alerts.read"]);
      reply.header("cache-control", "no-store");
      return deps.accountEmailAlerts.view(requireShopSubject(request));
    },
  );

  app.put(
    "/v1/me/email-alerts/topics/:topic",
    {
      schema: {
        tags: ["catalogue"],
        params: AccountEmailAlertTopicParamsSchema,
        body: AccountEmailAlertSwitchBodySchema,
        response: {
          200: AccountEmailAlertSavedSchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          409: AccountEmailAlertRefusalSchema,
        },
      },
    },
    async (request, reply) => {
      requireAnyShopScope(request, ["shop.write", "lax.alerts.write"]);
      const { topic } = request.params as { topic: AccountEmailAlertTopic };
      const { on } = request.body as { on: boolean };
      const reason = await deps.accountEmailAlerts.setTopic({
        identitySubjectId: requireShopSubject(request),
        topic,
        on,
      });
      if (reason) return reply.code(409).send({ ok: false, reason });
      return { ok: true };
    },
  );
}
