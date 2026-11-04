import { AdminReleaseAlertSummarySchema, ShopApiErrorBodySchema } from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type { ReleaseAlertSummaryReader } from "../../../application/alerts/alert-ports.js";
import { requireShopStaffCapability } from "../../../plugins/shop-admin-auth.js";

/** How many people are on the release alert list. Reading it needs `lead.read`, like leads. */
export async function registerAdminReleaseAlertRoutes(
  app: FastifyInstance,
  summary: ReleaseAlertSummaryReader,
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
      return summary.counts();
    },
  );
}
