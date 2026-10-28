import {
  ADMIN_ARTWORK_VISIBILITY_ACTIONS,
  type AdminArtworkBulkVisibilityBody,
  AdminArtworkBulkVisibilityBodySchema,
  AdminArtworkBulkVisibilityResponseSchema,
  type AdminArtworkCreateBody,
  AdminArtworkCreateBodySchema,
  AdminArtworkCreateResponseSchema,
  AdminArtworkDetailSchema,
  type AdminArtworkListQuery,
  AdminArtworkListQuerySchema,
  AdminArtworkListSchema,
  type AdminArtworkPriceBody,
  AdminArtworkPriceBodySchema,
  type AdminArtworkUpdateBody,
  AdminArtworkUpdateBodySchema,
  AdminArtworkVersionResponseSchema,
  CatalogueConflictBodySchema,
  EDITION_RUN_MAX_SIZE,
  SALE_AUTHORITY_NOTE_MAX_LENGTH,
  SeoFieldsWriteProperties,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { roleHasCapability } from "@auction/shop-domain";
import { type Static, Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { cleanArtworkFields } from "../../../application/admin/artwork-input.js";
import type { ImportArtworkCommand } from "../../../application/ports/artwork-import.writer.js";
import { notFound } from "../../../errors/shop-api-error.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireAnyShopStaffCapability,
  requireRecentAuthentication,
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";
import { afterArtCatalogueWrite } from "./art-cache-invalidation.js";

const ArtworkParams = Type.Object({ id: Type.String({ format: "uuid" }) });

/** Catalogue editors, and staff who set prices without editing the catalogue (finance). */
const ARTWORK_READERS = ["catalogue.write", "artwork_price.write"] as const;

/** Descriptions run to 10,000 characters and a gallery to 20 images; the app default is 1 KB. */
const ARTWORK_BODY_LIMIT = 65_536;

const WRITE_ERRORS = {
  400: ShopApiErrorBodySchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: CatalogueConflictBodySchema,
} as const;

/**
 * Who is writing, under which idempotency key, and whether they may set prices. Every artwork
 * write needs `catalogue.write`; a price change also needs `artwork_price.write`, which the
 * writer checks against the stored price so an unchanged price never needs it.
 */
function catalogueWriter(request: FastifyRequest) {
  const auth = requireShopStaffCapability(request, "catalogue.write");
  return {
    actorSubjectId: requireShopAdminSubject(request),
    idempotencyKey: requireIdempotencyKey(request),
    canSetPrice: roleHasCapability(auth.role, "artwork_price.write"),
  };
}

const ImportArtworkBodySchema = Type.Object({
  importKey: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  description: Type.Union([Type.String(), Type.Null()]),
  primaryImageUrl: Type.Union([Type.String(), Type.Null()]),
  dimensions: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  medium: Type.Optional(Type.Union([Type.String({ minLength: 1, maxLength: 200 }), Type.Null()])),
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
  ...SeoFieldsWriteProperties,
});

const ImportArtworkResponseSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  created: Type.Boolean(),
  editionCount: Type.Integer({ minimum: 0 }),
});

/** The count is capped by the prints the owner holds in the run, which shop-api checks. */
const GrantSaleAuthorityBodySchema = Type.Object({
  ownerPartyId: Type.String({ format: "uuid" }),
  authorisedCount: Type.Integer({ minimum: 0, maximum: EDITION_RUN_MAX_SIZE }),
  evidenceNote: Type.String({ minLength: 1, maxLength: SALE_AUTHORITY_NOTE_MAX_LENGTH }),
  requestId: Type.Optional(Type.String({ format: "uuid" })),
});

const GrantSaleAuthorityResponseSchema = Type.Object({
  grantId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  ownerPartyId: Type.String({ format: "uuid" }),
  authorisedCount: Type.Integer({ minimum: 0 }),
  /** Stock references of the prints put on sale or taken off; equal to the number when numbered. */
  editionNumbersAuthorised: Type.Array(Type.Integer()),
  editionNumbersRevoked: Type.Array(Type.Integer()),
});

export async function registerAdminArtworkRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
  app.get(
    "/artworks",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminArtworkListQuerySchema,
        response: {
          200: AdminArtworkListSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireAnyShopStaffCapability(request, ARTWORK_READERS);
      return deps.adminRead.artworks.listArtworks(request.query as AdminArtworkListQuery);
    },
  );

  app.get(
    "/artworks/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: ArtworkParams,
        response: {
          200: AdminArtworkDetailSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireAnyShopStaffCapability(request, ARTWORK_READERS);
      const { id } = request.params as Static<typeof ArtworkParams>;
      const artwork = await deps.adminRead.artworks.getArtwork(id);
      if (!artwork) throw notFound("Artwork not found");
      return artwork;
    },
  );

  app.post(
    "/artworks",
    {
      bodyLimit: ARTWORK_BODY_LIMIT,
      schema: {
        tags: ["shop-admin"],
        body: AdminArtworkCreateBodySchema,
        response: { 200: AdminArtworkCreateResponseSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const actor = catalogueWriter(request);
      const body = request.body as AdminArtworkCreateBody;
      const result = await deps.artworkCatalogue.createArtwork({
        ...actor,
        ...cleanArtworkFields(body),
        slug: body.slug,
        run: body.run,
      });
      return afterArtCatalogueWrite(request, deps.artCache, "artworks", result);
    },
  );

  app.put(
    "/artworks/:id",
    {
      bodyLimit: ARTWORK_BODY_LIMIT,
      schema: {
        tags: ["shop-admin"],
        params: ArtworkParams,
        body: AdminArtworkUpdateBodySchema,
        response: { 200: Type.Object({ version: Type.String() }), ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const actor = catalogueWriter(request);
      const { id } = request.params as Static<typeof ArtworkParams>;
      const body = request.body as AdminArtworkUpdateBody;
      const result = await deps.artworkCatalogue.updateArtwork({
        ...actor,
        ...cleanArtworkFields(body),
        artworkId: id,
        expectedVersion: body.expectedVersion,
      });
      return afterArtCatalogueWrite(request, deps.artCache, "artworks", result);
    },
  );

  app.put(
    "/artworks/:id/price",
    {
      schema: {
        tags: ["shop-admin"],
        params: ArtworkParams,
        body: AdminArtworkPriceBodySchema,
        response: { 200: Type.Object({ version: Type.String() }), ...WRITE_ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_price.write");
      const { id } = request.params as Static<typeof ArtworkParams>;
      const body = request.body as AdminArtworkPriceBody;
      const result = await deps.artworkCatalogue.setPrice({
        artworkId: id,
        printPricePence: body.printPricePence ?? null,
        expectedVersion: body.expectedVersion,
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
      });
      return afterArtCatalogueWrite(request, deps.artCache, "artworks", result);
    },
  );

  for (const action of ADMIN_ARTWORK_VISIBILITY_ACTIONS) {
    app.post(
      `/artworks/:id/${action}`,
      {
        schema: {
          tags: ["shop-admin"],
          params: ArtworkParams,
          response: { 200: AdminArtworkVersionResponseSchema, ...WRITE_ERRORS },
        },
      },
      async (request) => {
        const { canSetPrice: _unused, ...actor } = catalogueWriter(request);
        const { id } = request.params as Static<typeof ArtworkParams>;
        const result = await deps.artworkCatalogue.setVisibility({
          ...actor,
          artworkId: id,
          action,
        });
        return afterArtCatalogueWrite(request, deps.artCache, "artworks", result);
      },
    );
  }

  app.post(
    "/artworks/visibility",
    {
      bodyLimit: ARTWORK_BODY_LIMIT,
      schema: {
        tags: ["shop-admin"],
        body: AdminArtworkBulkVisibilityBodySchema,
        response: { 200: AdminArtworkBulkVisibilityResponseSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const { canSetPrice: _unused, ...actor } = catalogueWriter(request);
      const body = request.body as AdminArtworkBulkVisibilityBody;
      const result = await deps.artworkCatalogue.applyBulkVisibility({
        ...actor,
        action: body.action,
        artworkIds: body.artworkIds,
      });
      return afterArtCatalogueWrite(request, deps.artCache, "artworks", result);
    },
  );

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
      const idempotencyKey = requireIdempotencyKey(request);
      const body = request.body as ImportArtworkCommand;
      return deps.importArtwork(body, {
        idempotencyKey,
        actorSubjectId: requireShopAdminSubject(request),
      });
    },
  );

  app.post(
    "/artworks/:id/sale-authority",
    {
      bodyLimit: 8_192,
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
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const idempotencyKey = requireIdempotencyKey(request);
      const subject = requireShopAdminSubject(request);
      const { id: artworkId } = request.params as { id: string };
      const body = request.body as {
        ownerPartyId: string;
        authorisedCount: number;
        evidenceNote: string;
        requestId?: string;
      };
      return deps.grantSaleAuthority(
        {
          artworkId,
          ownerPartyId: body.ownerPartyId,
          authorisedCount: body.authorisedCount,
          evidenceNote: body.evidenceNote,
          recordedBySubjectId: subject,
          ...(body.requestId ? { requestId: body.requestId } : {}),
        },
        { idempotencyKey, actorSubjectId: subject },
      );
    },
  );
}
