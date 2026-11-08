import {
  AdminDeliveryRegionParamsSchema,
  AdminDeliveryRegionRejectedBodySchema,
  type AdminDeliveryRegionUpdateBody,
  AdminDeliveryRegionUpdateBodySchema,
  AdminDeliveryRegionsSchema,
  type AdminDeliveryRestrictedCountriesBody,
  AdminDeliveryRestrictedCountriesBodySchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { DELIVERY_REGIONS_EDIT_CAPABILITY, type DeliveryRegionId } from "@auction/shop-domain";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffAuth,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";
import { presentAdminDeliveryRegions } from "../../../presenters/delivery-regions.presenter.js";

/**
 * Delivery regions in LAX Admin › Settings. Every staff member can read them (the delivery page
 * shows the same to buyers); changing them needs `settings.write`.
 */
export async function registerAdminDeliveryRegionRoutes(
  app: FastifyInstance,
  deps: Pick<AdminRoutesDeps, "deliveryRegions">,
) {
  app.get(
    "/delivery-regions",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminDeliveryRegionsSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffAuth(request);
      return presentAdminDeliveryRegions(await deps.deliveryRegions.read());
    },
  );

  app.put(
    "/delivery-regions/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminDeliveryRegionParamsSchema,
        body: AdminDeliveryRegionUpdateBodySchema,
        response: {
          200: AdminDeliveryRegionsSchema,
          400: AdminDeliveryRegionRejectedBodySchema,
          403: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, DELIVERY_REGIONS_EDIT_CAPABILITY);
      const body = request.body as AdminDeliveryRegionUpdateBody;
      const state = await deps.deliveryRegions.updateRegion({
        id: (request.params as { id: DeliveryRegionId }).id,
        edit: {
          standard: { minDays: body.standardMinDays, maxDays: body.standardMaxDays },
          specialist: { minDays: body.specialistMinDays, maxDays: body.specialistMaxDays },
          fixedPricePence: body.fixedPricePence,
        },
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
      });
      return presentAdminDeliveryRegions(state);
    },
  );

  app.put(
    "/delivery-regions/not-delivered-to",
    {
      schema: {
        tags: ["shop-admin"],
        body: AdminDeliveryRestrictedCountriesBodySchema,
        response: {
          200: AdminDeliveryRegionsSchema,
          400: AdminDeliveryRegionRejectedBodySchema,
          403: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, DELIVERY_REGIONS_EDIT_CAPABILITY);
      const body = request.body as AdminDeliveryRestrictedCountriesBody;
      const state = await deps.deliveryRegions.replaceRestrictedCountries({
        codes: body.countries,
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
      });
      return presentAdminDeliveryRegions(state);
    },
  );
}
