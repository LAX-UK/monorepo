import {
  AdminHomeCoverPictureCandidatesSchema,
  AdminHomeCoverRejectedBodySchema,
  type AdminHomeCoverSaveBody,
  AdminHomeCoverSaveBodySchema,
  AdminHomeCoverSchema,
  type AdminLookupQuery,
  AdminLookupQuerySchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { HOME_COVER_EDIT_CAPABILITY } from "@auction/shop-domain";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffAuth,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const PICTURE_LIMIT = 15;

/**
 * The picture that leads the Shop home's first screen, in LAX Admin. Every staff member can read
 * it, which only shows what the home already shows; choosing, saving and removing it publishes, so
 * those need `editorial.publish`.
 */
export async function registerAdminHomeCoverRoutes(
  app: FastifyInstance,
  deps: Pick<AdminRoutesDeps, "homeCover">,
) {
  app.get(
    "/home-cover",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminHomeCoverSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffAuth(request);
      return deps.homeCover.read();
    },
  );

  app.get(
    "/home-cover/pictures",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminLookupQuerySchema,
        response: { 200: AdminHomeCoverPictureCandidatesSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, HOME_COVER_EDIT_CAPABILITY);
      const query = request.query as AdminLookupQuery;
      return deps.homeCover.searchPictures({
        ...(query.q ? { q: query.q } : {}),
        limit: Math.min(query.limit ?? PICTURE_LIMIT, PICTURE_LIMIT),
      });
    },
  );

  app.put(
    "/home-cover",
    {
      schema: {
        tags: ["shop-admin"],
        body: AdminHomeCoverSaveBodySchema,
        response: {
          200: AdminHomeCoverSchema,
          400: AdminHomeCoverRejectedBodySchema,
          403: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, HOME_COVER_EDIT_CAPABILITY);
      const body = request.body as AdminHomeCoverSaveBody;
      return deps.homeCover.save({
        mediaKey: body.mediaKey,
        alt: body.alt,
        focal: body.focal,
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
      });
    },
  );

  app.delete(
    "/home-cover",
    {
      schema: {
        tags: ["shop-admin"],
        response: {
          200: AdminHomeCoverSchema,
          403: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, HOME_COVER_EDIT_CAPABILITY);
      return deps.homeCover.clear({
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
      });
    },
  );
}
