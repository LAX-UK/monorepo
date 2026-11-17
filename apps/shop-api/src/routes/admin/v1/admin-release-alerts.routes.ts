import {
  AdminReleaseAlertSendListSchema,
  type AdminReleaseAlertSendParams,
  AdminReleaseAlertSendParamsSchema,
  AdminReleaseAlertSendSchema,
  type AdminReleaseAlertSendsQuery,
  AdminReleaseAlertSendsQuerySchema,
  AdminReleaseAlertSummarySchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type {
  ReleaseAlertSendLogReader,
  ReleaseAlertSummaryReader,
} from "../../../application/alerts/alert-ports.js";
import { requireShopStaffCapability } from "../../../plugins/shop-admin-auth.js";

/**
 * The release alert list in LAX Admin: how many people are on it, and what each published release
 * sent. Reading either needs `lead.read`, like leads. Both are counts; no subscriber is named.
 */
export async function registerAdminReleaseAlertRoutes(
  app: FastifyInstance,
  readers: { summary: ReleaseAlertSummaryReader; sends: ReleaseAlertSendLogReader },
) {
  app.get(
    "/release-alerts/summary",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminReleaseAlertSummarySchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "lead.read");
      return readers.summary.counts();
    },
  );

  app.get<{ Querystring: AdminReleaseAlertSendsQuery }>(
    "/release-alerts/sends",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminReleaseAlertSendsQuerySchema,
        response: {
          200: AdminReleaseAlertSendListSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "lead.read");
      const { cursor, limit } = request.query;
      return readers.sends.list({ cursor, limit });
    },
  );

  /** One release by its work: a panel link whose release is not on the page shown (PRD-7). */
  app.get<{ Params: AdminReleaseAlertSendParams }>(
    "/release-alerts/sends/:artworkId",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminReleaseAlertSendParamsSchema,
        response: {
          200: AdminReleaseAlertSendSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "lead.read");
      const send = await readers.sends.find(request.params.artworkId);
      if (!send) {
        return reply.status(404).send({ code: "not_found", message: "Release alert not found" });
      }
      return send;
    },
  );
}
