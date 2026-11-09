import {
  AdminEditionFramingRejectedBodySchema,
  type AdminEditionFramingSaveBody,
  AdminEditionFramingSaveBodySchema,
  AdminEditionFramingSchema,
  FramingConflictBodySchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { FRAMING_EDIT_CAPABILITY, FRAMING_READ_CAPABILITY } from "@auction/shop-domain";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffAuth,
  requireShopStaffCapability,
  staffCan,
} from "../../../plugins/shop-admin-auth.js";

const ArtworkParams = Type.Object({ artworkId: Type.String({ format: "uuid" }) });
const artworkIdOf = (request: FastifyRequest) =>
  (request.params as { artworkId: string }).artworkId;

/**
 * Framing on an edition, in LAX Admin: how it is sold, which catalogue options it offers and its
 * own price for each. Reading needs `catalogue.read`; saving needs `catalogue.write`, and setting
 * an edition's own price also needs `artwork_price.write`, since it is money.
 */
export async function registerAdminEditionFramingRoutes(
  app: FastifyInstance,
  deps: Pick<AdminRoutesDeps, "editionFraming">,
) {
  app.get(
    "/artworks/:artworkId/framing",
    {
      schema: {
        tags: ["shop-admin"],
        params: ArtworkParams,
        response: {
          200: AdminEditionFramingSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, FRAMING_READ_CAPABILITY);
      return deps.editionFraming.get(artworkIdOf(request));
    },
  );

  app.put(
    "/artworks/:artworkId/framing",
    {
      schema: {
        tags: ["shop-admin"],
        params: ArtworkParams,
        body: AdminEditionFramingSaveBodySchema,
        response: {
          200: AdminEditionFramingSchema,
          400: AdminEditionFramingRejectedBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: FramingConflictBodySchema,
        },
      },
    },
    async (request) => {
      const auth = requireShopStaffAuth(request);
      requireShopStaffCapability(request, FRAMING_EDIT_CAPABILITY);
      return deps.editionFraming.save({
        artworkId: artworkIdOf(request),
        body: request.body as AdminEditionFramingSaveBody,
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
        maySetPrices: staffCan(auth, "artwork_price.write"),
      });
    },
  );
}
