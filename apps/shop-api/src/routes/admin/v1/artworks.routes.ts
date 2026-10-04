import { ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import type { ImportArtworkCommand } from "../../../application/ports/artwork-import.writer.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const ImportArtworkBodySchema = Type.Object({
  importKey: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  description: Type.Union([Type.String(), Type.Null()]),
  primaryImageUrl: Type.Union([Type.String(), Type.Null()]),
  dimensions: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  yearCreated: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  saleState: Type.Optional(
    Type.Union([
      Type.Literal("for_sale"),
      Type.Literal("price_on_application"),
      Type.Literal("sold"),
    ]),
  ),
  artistSlug: Type.String({ minLength: 1 }),
  artistDisplayName: Type.String({ minLength: 1 }),
  artistDiscipline: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  artistPortraitUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  eligibleForEditionAllocation: Type.Boolean(),
  printPricePence: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
});

const ImportArtworkResponseSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  created: Type.Boolean(),
  editionCount: Type.Integer({ minimum: 0 }),
});

const GrantSaleAuthorityBodySchema = Type.Object({
  ownerPartyId: Type.String({ format: "uuid" }),
  authorisedCount: Type.Integer({ minimum: 0, maximum: 10 }),
  evidenceNote: Type.String({ minLength: 1 }),
  requestId: Type.Optional(Type.String({ format: "uuid" })),
});

const GrantSaleAuthorityResponseSchema = Type.Object({
  grantId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  ownerPartyId: Type.String({ format: "uuid" }),
  authorisedCount: Type.Integer({ minimum: 0, maximum: 10 }),
  editionNumbersAuthorised: Type.Array(Type.Integer()),
  editionNumbersRevoked: Type.Array(Type.Integer()),
});

export async function registerAdminArtworkRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
  app.post(
    "/artworks/import",
    {
      config: { rawBody: false },
      bodyLimit: 65_536,
      schema: {
        tags: ["shop-admin"],
        body: ImportArtworkBodySchema,
        response: {
          200: ImportArtworkResponseSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.write");
      requireIdempotencyKey(request);
      const body = request.body as ImportArtworkCommand;
      return deps.importArtwork(body);
    },
  );

  app.post(
    "/artworks/:id/sale-authority",
    {
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({ id: Type.String({ format: "uuid" }) }),
        body: GrantSaleAuthorityBodySchema,
        response: {
          200: GrantSaleAuthorityResponseSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "sale_authority.write");
      requireIdempotencyKey(request);
      const subject = requireShopAdminSubject(request);
      const { id: artworkId } = request.params as { id: string };
      const body = request.body as {
        ownerPartyId: string;
        authorisedCount: number;
        evidenceNote: string;
        requestId?: string;
      };
      return deps.grantSaleAuthority({
        artworkId,
        ownerPartyId: body.ownerPartyId,
        authorisedCount: body.authorisedCount,
        evidenceNote: body.evidenceNote,
        recordedBySubjectId: subject,
        ...(body.requestId ? { requestId: body.requestId } : {}),
      });
    },
  );
}
