import {
  type AdminAuctionOfferAssessment,
  AdminAuctionOfferAssessmentSchema,
  AdminAuctionSalesSchema,
  type AdminOfferAtAuctionBody,
  AdminOfferAtAuctionBodySchema,
  AdminOfferAtAuctionResponseSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { ShopStaffCapability } from "@auction/shop-domain";
import { type Static, Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import {
  requireAnyShopStaffCapability,
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";
import { moveAgreementForViewer } from "./move-agreement-viewer.js";

const ArtworkParams = Type.Object({ id: Type.String({ format: "uuid" }) });
const RegisterParams = Type.Object({ registerId: Type.String({ format: "uuid" }) });

const ERRORS = {
  400: ShopApiErrorBodySchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: ShopApiErrorBodySchema,
  502: ShopApiErrorBodySchema,
} as const;

/** What offering a lax.art original at auction needs (`POST /artworks/:id/offer-at-auction`). */
const ARTWORK_MOVE = ["catalogue.write"] as const satisfies readonly ShopStaffCapability[];
/** What offering a From Zoho record at auction needs (`POST .../offer-at-auction`). */
const REGISTER_MOVE = [
  "catalogue.write",
  "artwork_register.review",
] as const satisfies readonly ShopStaffCapability[];

/**
 * Moving an original to a LAX Bid sale, from its lax.art page (`catalogue.*`) or from its record
 * in the artwork register. Checking a record needs `artwork_register.read`. Offering it needs both
 * `catalogue.write` (a live lax.art listing is taken down) and `artwork_register.review` (the
 * people who decide on the register are the ones who put its artworks on sale).
 */
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
      return forViewer(request, deps, await deps.inventoryMoves.assess(id), ARTWORK_MOVE);
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
      requireAnyShopStaffCapability(request, ["catalogue.read", "artwork_register.read"]);
      return deps.inventoryMoves.listSales();
    },
  );

  app.get(
    "/artwork-register/:registerId/auction-offer",
    {
      schema: {
        tags: ["shop-admin"],
        params: RegisterParams,
        response: { 200: AdminAuctionOfferAssessmentSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      const { registerId } = request.params as Static<typeof RegisterParams>;
      return forViewer(
        request,
        deps,
        await deps.inventoryMoves.assessRegister(registerId),
        REGISTER_MOVE,
      );
    },
  );

  app.post(
    "/artwork-register/:registerId/offer-at-auction",
    {
      schema: {
        tags: ["shop-admin"],
        params: RegisterParams,
        body: AdminOfferAtAuctionBodySchema,
        response: { 200: AdminOfferAtAuctionResponseSchema, ...ERRORS },
      },
    },
    async (request) => {
      for (const capability of REGISTER_MOVE) requireShopStaffCapability(request, capability);
      const { registerId } = request.params as Static<typeof RegisterParams>;
      const body = request.body as AdminOfferAtAuctionBody;
      const result = await deps.inventoryMoves.offerRegisterAtAuction({
        registerId,
        saleId: body.saleId,
        startingPrice: body.startingPrice,
        consignorAgreed: body.consignorAgreed === true,
        actorSubjectId: requireShopAdminSubject(request),
      });
      invalidateIfTakenDown(deps, request, result.withdrawnFromLaxArt);
      return result;
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
      for (const capability of ARTWORK_MOVE) requireShopStaffCapability(request, capability);
      const { id } = request.params as Static<typeof ArtworkParams>;
      const body = request.body as AdminOfferAtAuctionBody;
      const result = await deps.inventoryMoves.offerAtAuction({
        artworkId: id,
        saleId: body.saleId,
        startingPrice: body.startingPrice,
        consignorAgreed: body.consignorAgreed === true,
        actorSubjectId: requireShopAdminSubject(request),
      });
      invalidateIfTakenDown(deps, request, result.withdrawnFromLaxArt);
      return result;
    },
  );
}

/**
 * The consignor agreement line, with what this person may not read left out. `moveCapabilities`
 * are what the matching move route requires; holding them keeps the lowest price.
 */
async function forViewer(
  request: FastifyRequest,
  deps: AdminRoutesDeps,
  assessment: AdminAuctionOfferAssessment,
  moveCapabilities: readonly ShopStaffCapability[],
): Promise<AdminAuctionOfferAssessment> {
  if (!assessment.consignorAgreement) return assessment;
  return {
    ...assessment,
    consignorAgreement: await moveAgreementForViewer(
      request,
      deps,
      assessment.consignorAgreement,
      moveCapabilities,
    ),
  };
}

/** A listing taken off lax.art changes what buyers see, so the public catalogue is refreshed. */
function invalidateIfTakenDown(
  deps: AdminRoutesDeps,
  request: FastifyRequest,
  withdrawnFromLaxArt: boolean,
) {
  if (!withdrawnFromLaxArt) return;
  deps.artCache.invalidateCatalogue("artworks").catch((error: unknown) => {
    request.log.warn({ err: error }, "lax.art catalogue cache invalidation failed");
  });
}
