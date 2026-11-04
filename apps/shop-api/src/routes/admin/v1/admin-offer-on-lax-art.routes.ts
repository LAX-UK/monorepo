import {
  AdminLaxArtOfferAssessmentSchema,
  type AdminLaxArtOfferBody,
  AdminLaxArtOfferBodySchema,
  AdminLaxArtOfferResponseSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { type Static, Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const RegisterParams = Type.Object({ registerId: Type.String({ format: "uuid" }) });

const ERRORS = {
  400: ShopApiErrorBodySchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: ShopApiErrorBodySchema,
} as const;

/**
 * "Offer on lax.art" for a From Zoho record. Checking needs `artwork_register.read`. Making the
 * draft needs both `catalogue.write` (it creates a lax.art artwork) and `artwork_register.review`
 * (the people who decide on the register are the ones who put its artworks on sale).
 */
export async function registerAdminOfferOnLaxArtRoutes(
  app: FastifyInstance,
  deps: Pick<AdminRoutesDeps, "offerOnLaxArt">,
) {
  app.get(
    "/artwork-register/:registerId/lax-art-offer",
    {
      schema: {
        tags: ["shop-admin"],
        params: RegisterParams,
        response: { 200: AdminLaxArtOfferAssessmentSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      const { registerId } = request.params as Static<typeof RegisterParams>;
      return deps.offerOnLaxArt.assess(registerId);
    },
  );

  app.post(
    "/artwork-register/:registerId/lax-art-offer",
    {
      schema: {
        tags: ["shop-admin"],
        params: RegisterParams,
        body: AdminLaxArtOfferBodySchema,
        response: { 200: AdminLaxArtOfferResponseSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.write");
      requireShopStaffCapability(request, "artwork_register.review");
      const { registerId } = request.params as Static<typeof RegisterParams>;
      return deps.offerOnLaxArt.offer({
        registerId,
        body: request.body as AdminLaxArtOfferBody,
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
      });
    },
  );
}
