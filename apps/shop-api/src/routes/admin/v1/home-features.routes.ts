import {
  AdminHomeFeatureCandidatesSchema,
  AdminHomeFeatureRejectedBodySchema,
  type AdminHomeFeatureReplaceBody,
  AdminHomeFeatureReplaceBodySchema,
  type AdminHomeFeatureSlot,
  AdminHomeFeatureSlotParamsSchema,
  AdminHomeFeaturesSchema,
  type AdminLookupQuery,
  AdminLookupQuerySchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { HOME_FEATURES_EDIT_CAPABILITY } from "@auction/shop-domain";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffAuth,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";
import { afterArtCatalogueWrite } from "./art-cache-invalidation.js";

const CANDIDATE_LIMIT = 15;

function slotOf(request: FastifyRequest): AdminHomeFeatureSlot {
  return (request.params as { slot: AdminHomeFeatureSlot }).slot;
}

/**
 * Featured on home in LAX Admin: the prints, artists and categories the Shop home features (the
 * artists also feature on lax.art). Every staff member can read the lists, which only show what
 * is already public; choosing and saving them publishes, so it needs `editorial.publish`.
 */
export async function registerAdminHomeFeatureRoutes(
  app: FastifyInstance,
  deps: Pick<AdminRoutesDeps, "homeFeatures" | "artCache">,
) {
  app.get(
    "/home-features",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminHomeFeaturesSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffAuth(request);
      return deps.homeFeatures.list();
    },
  );

  app.get(
    "/home-features/:slot/candidates",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminHomeFeatureSlotParamsSchema,
        querystring: AdminLookupQuerySchema,
        response: { 200: AdminHomeFeatureCandidatesSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, HOME_FEATURES_EDIT_CAPABILITY);
      const query = request.query as AdminLookupQuery;
      return {
        items: await deps.homeFeatures.searchCandidates(slotOf(request), {
          ...(query.q ? { q: query.q } : {}),
          limit: Math.min(query.limit ?? CANDIDATE_LIMIT, CANDIDATE_LIMIT),
        }),
      };
    },
  );

  app.put(
    "/home-features/:slot",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminHomeFeatureSlotParamsSchema,
        body: AdminHomeFeatureReplaceBodySchema,
        response: {
          200: AdminHomeFeaturesSchema,
          400: AdminHomeFeatureRejectedBodySchema,
          403: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, HOME_FEATURES_EDIT_CAPABILITY);
      const body = request.body as AdminHomeFeatureReplaceBody;
      const result = await deps.homeFeatures.replace({
        slot: slotOf(request),
        ids: body.ids,
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
      });
      return afterArtCatalogueWrite(request, deps.artCache, "artists", result).features;
    },
  );
}
