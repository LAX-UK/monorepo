import {
  AdminAuctionOfferAssessmentSchema,
  AdminAuctionSalesSchema,
  type AdminOfferAtAuctionBody,
  AdminOfferAtAuctionBodySchema,
  AdminOfferAtAuctionResponseSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { type Static, Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const ArtworkParams = Type.Object({ id: Type.String({ format: "uuid" }) });

const ERRORS = {
  400: ShopApiErrorBodySchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: ShopApiErrorBodySchema,
  502: ShopApiErrorBodySchema,
} as const;

/** Moving an original from lax.art to a LAX Bid sale. Staff with catalogue access only. */
export async function registerAdminInventoryMoveRoutes(
  app: FastifyInstance,
  deps: AdminRoutesDeps,
) {
  app.get(
    "/artworks/:id/auction-offer",
    {
      schema: {
        tags: ["shop-admin"],
        params: ArtworkParams,
        response: { 200: AdminAuctionOfferAssessmentSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.read");
      const { id } = request.params as Static<typeof ArtworkParams>;
      return deps.inventoryMoves.assess(id);
    },
  );

  app.get(
    "/inventory/auction-sales",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminAuctionSalesSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.read");
      return { sales: await deps.inventoryMoves.listSales() };
    },
  );

  app.post(
    "/artworks/:id/offer-at-auction",
    {
      schema: {
        tags: ["shop-admin"],
        params: ArtworkParams,
        body: AdminOfferAtAuctionBodySchema,
        response: { 200: AdminOfferAtAuctionResponseSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.write");
      const { id } = request.params as Static<typeof ArtworkParams>;
      const body = request.body as AdminOfferAtAuctionBody;
      const result = await deps.inventoryMoves.offerAtAuction({
        artworkId: id,
        saleId: body.saleId,
        startingPrice: body.startingPrice,
        actorSubjectId: requireShopAdminSubject(request),
      });
      if (result.withdrawnFromLaxArt) {
        deps.artCache.invalidateCatalogue("artworks").catch((error: unknown) => {
          request.log.warn({ err: error }, "lax.art catalogue cache invalidation failed");
        });
      }
      return result;
    },
  );
}
