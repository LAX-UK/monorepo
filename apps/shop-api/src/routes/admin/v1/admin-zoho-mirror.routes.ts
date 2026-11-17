import {
  AdminZohoMirrorStatusListSchema,
  type AdminZohoMirrorStatusQuery,
  AdminZohoMirrorStatusQuerySchema,
  AdminZohoMirrorStatusSchema,
  type AdminZohoMirrorStatusesQuery,
  AdminZohoMirrorStatusesQuerySchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
  ZOHO_MIRROR_BATCH_LIMIT,
  type ZohoMirrorEntity,
} from "@auction/shop-contracts";
import type { ShopStaffCapability } from "@auction/shop-domain";
import type { FastifyInstance } from "fastify";
import type { ZohoMirrorStatusService } from "../../../application/zoho-mirror/zoho-mirror-status.service.js";
import { ShopApiError } from "../../../errors/shop-api-error.js";
import { requireShopStaffCapability } from "../../../plugins/shop-admin-auth.js";

const SCHEMA = { tags: ["shop-admin"] };
const ERRORS = { 400: ShopApiErrorBodySchema, 403: ShopApiErrorBodySchema };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Asking about a record needs the same capability as the page that shows it. */
const READ_CAPABILITY: Record<ZohoMirrorEntity, ShopStaffCapability> = {
  order: "order.read",
  artwork: "artwork_register.read",
};

function idsOf(query: AdminZohoMirrorStatusesQuery): string[] {
  const ids = [...new Set(query.ids.split(",").map((id) => id.trim().toLowerCase()))];
  if (ids.length > ZOHO_MIRROR_BATCH_LIMIT || ids.some((id) => !UUID.test(id))) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.VALIDATION,
      `Send up to ${ZOHO_MIRROR_BATCH_LIMIT} valid ids`,
      400,
    );
  }
  return ids;
}

/**
 * Whether an order or an artwork reached Zoho, for the "Mirrored to Zoho" badge. Reads only; the
 * state is worked out from the delivery ledger each time.
 */
export async function registerAdminZohoMirrorRoutes(
  app: FastifyInstance,
  mirror: ZohoMirrorStatusService,
) {
  app.get(
    "/zoho-mirror/status",
    {
      schema: {
        ...SCHEMA,
        querystring: AdminZohoMirrorStatusQuerySchema,
        response: { 200: AdminZohoMirrorStatusSchema, ...ERRORS },
      },
    },
    async (request) => {
      const { entity, id } = request.query as AdminZohoMirrorStatusQuery;
      requireShopStaffCapability(request, READ_CAPABILITY[entity]);
      return mirror.status(entity, id.toLowerCase());
    },
  );

  app.get(
    "/zoho-mirror/statuses",
    {
      schema: {
        ...SCHEMA,
        querystring: AdminZohoMirrorStatusesQuerySchema,
        response: { 200: AdminZohoMirrorStatusListSchema, ...ERRORS },
      },
    },
    async (request) => {
      const query = request.query as AdminZohoMirrorStatusesQuery;
      requireShopStaffCapability(request, READ_CAPABILITY[query.entity]);
      return { items: await mirror.statuses(query.entity, idsOf(query)) };
    },
  );
}
