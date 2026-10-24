import {
  AdminArtistArchiveResponseSchema,
  type AdminArtistCreateBody,
  AdminArtistCreateBodySchema,
  AdminArtistCreateResponseSchema,
  CatalogueConflictBodySchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { type Static, Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { cleanArtistFields } from "../../../application/admin/artwork-input.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";
import { afterArtCatalogueWrite } from "./art-cache-invalidation.js";

const ArtistParams = Type.Object({ artistId: Type.String({ format: "uuid" }) });

const WRITE_ERRORS = {
  400: ShopApiErrorBodySchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: CatalogueConflictBodySchema,
} as const;

function catalogueWriter(request: FastifyRequest) {
  requireShopStaffCapability(request, "catalogue.write");
  return {
    actorSubjectId: requireShopAdminSubject(request),
    idempotencyKey: requireIdempotencyKey(request),
  };
}

/** Staff create artists and archive or restore them; artists are never deleted. */
export async function registerAdminArtistRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
  app.post(
    "/artists",
    {
      schema: {
        tags: ["shop-admin"],
        body: AdminArtistCreateBodySchema,
        response: { 200: AdminArtistCreateResponseSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      const actor = catalogueWriter(request);
      const body = request.body as AdminArtistCreateBody;
      return deps.artistCatalogue.createArtist({ ...actor, ...cleanArtistFields(body) });
    },
  );

  for (const [segment, archived] of [
    ["archive", true],
    ["restore", false],
  ] as const) {
    app.post(
      `/artists/:artistId/${segment}`,
      {
        schema: {
          tags: ["shop-admin"],
          params: ArtistParams,
          response: { 200: AdminArtistArchiveResponseSchema, ...WRITE_ERRORS },
        },
      },
      async (request) => {
        const actor = catalogueWriter(request);
        const { artistId } = request.params as Static<typeof ArtistParams>;
        const result = await deps.artistCatalogue.setArtistArchived({
          ...actor,
          artistId,
          archived,
        });
        return afterArtCatalogueWrite(request, deps.artCache, "artists", result);
      },
    );
  }
}
