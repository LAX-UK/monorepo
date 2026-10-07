import { ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const LinkBodySchema = Type.Object({
  email: Type.String({ format: "email" }),
});

const LinkResponseSchema = Type.Object({
  artistId: Type.String({ format: "uuid" }),
  identitySubjectId: Type.String(),
});

export async function registerAdminArtistIdentityRoutes(
  app: FastifyInstance,
  deps: AdminRoutesDeps,
) {
  app.post(
    "/artists/:artistId/identity-link",
    {
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({ artistId: Type.String({ format: "uuid" }) }),
        body: LinkBodySchema,
        response: {
          200: LinkResponseSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.write");
      const idempotencyKey = requireIdempotencyKey(request);
      const actorSubjectId = requireShopAdminSubject(request);
      const { artistId } = request.params as { artistId: string };
      const body = request.body as { email: string };
      return deps.linkArtistIdentity({
        artistId,
        email: body.email,
        actorSubjectId,
        idempotencyKey,
      });
    },
  );

  app.delete(
    "/artists/:artistId/identity-link",
    {
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({ artistId: Type.String({ format: "uuid" }) }),
        response: {
          200: Type.Object({ artistId: Type.String({ format: "uuid" }) }),
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.write");
      const idempotencyKey = requireIdempotencyKey(request);
      const actorSubjectId = requireShopAdminSubject(request);
      const { artistId } = request.params as { artistId: string };
      return deps.unlinkArtistIdentity({
        artistId,
        actorSubjectId,
        idempotencyKey,
      });
    },
  );
}
