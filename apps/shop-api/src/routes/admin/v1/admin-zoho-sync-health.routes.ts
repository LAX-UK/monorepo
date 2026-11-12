import {
  AdminZohoDriftQuerySchema,
  AdminZohoProductWithoutRegisterListSchema,
  AdminZohoRegisterWithoutProductListSchema,
  AdminZohoStatusMismatchListSchema,
  AdminZohoSyncHealthSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { AdminZohoDriftQuery } from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type { ZohoSyncHealthService } from "../../../application/artwork-register/zoho-sync-health.service.js";
import { requireShopStaffCapability } from "../../../plugins/shop-admin-auth.js";

const SCHEMA = { tags: ["shop-admin"] };
const FORBIDDEN = { 403: ShopApiErrorBodySchema };

/**
 * The From Zoho Sync health tab: how the Zoho sync is doing and where Zoho and LAX disagree. All
 * reads, open to anyone who can read the From Zoho queue (`artwork_register.read`, which
 * `artwork_register.review` includes).
 */
export async function registerAdminZohoSyncHealthRoutes(
  app: FastifyInstance,
  health: ZohoSyncHealthService,
) {
  app.get(
    "/artwork-register/sync-health",
    { schema: { ...SCHEMA, response: { 200: AdminZohoSyncHealthSchema, ...FORBIDDEN } } },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      return health.summary();
    },
  );

  app.get(
    "/artwork-register/sync-health/register-without-product",
    {
      schema: {
        ...SCHEMA,
        querystring: AdminZohoDriftQuerySchema,
        response: { 200: AdminZohoRegisterWithoutProductListSchema, ...FORBIDDEN },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      return health.registerWithoutProduct(request.query as AdminZohoDriftQuery);
    },
  );

  app.get(
    "/artwork-register/sync-health/product-without-register",
    {
      schema: {
        ...SCHEMA,
        querystring: AdminZohoDriftQuerySchema,
        response: { 200: AdminZohoProductWithoutRegisterListSchema, ...FORBIDDEN },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      return health.productsWithoutRegister(request.query as AdminZohoDriftQuery);
    },
  );

  app.get(
    "/artwork-register/sync-health/status-mismatch",
    {
      schema: {
        ...SCHEMA,
        querystring: AdminZohoDriftQuerySchema,
        response: { 200: AdminZohoStatusMismatchListSchema, ...FORBIDDEN },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      return health.statusMismatches(request.query as AdminZohoDriftQuery);
    },
  );
}
