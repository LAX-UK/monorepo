import {
  ArtworkInterestIntentSchema,
  ArtworkInterestStatusSchema,
  RegisterArtworkInterestRequestSchema,
  RegisterArtworkInterestResponseSchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import { normalizeArtworkInterestIntent } from "../../application/artwork-interest-intent.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import type { InterestRoutesDeps } from "../../interest-route-deps.js";
import { requireShopScope, requireShopSubject } from "../../plugins/shop-auth.js";

type ArtworkInterestIntent = Static<typeof ArtworkInterestIntentSchema>;

const InterestQuerySchema = Type.Object({
  intent: Type.Optional(ArtworkInterestIntentSchema),
});

export async function registerArtworkInterestRoutes(
  app: FastifyInstance,
  deps: InterestRoutesDeps,
) {
  app.get(
    "/v1/artworks/:slug/interest",
    {
      schema: {
        tags: ["catalogue"],
        params: {
          type: "object",
          properties: { slug: { type: "string", minLength: 1 } },
          required: ["slug"],
        },
        querystring: InterestQuerySchema,
        response: {
          200: ArtworkInterestStatusSchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      const { slug } = request.params as { slug: string };
      const query = request.query as { intent?: ArtworkInterestIntent };
      const intent = normalizeArtworkInterestIntent(query.intent);
      const result = await deps.getArtworkInterest({
        artworkSlug: slug,
        identitySubjectId: subject,
        intent,
      });
      if (result === "artwork_not_found") {
        throw notFound("Artwork");
      }
      return result;
    },
  );

  app.post(
    "/v1/artworks/:slug/interest",
    {
      schema: {
        tags: ["catalogue"],
        params: {
          type: "object",
          properties: { slug: { type: "string", minLength: 1 } },
          required: ["slug"],
        },
        body: RegisterArtworkInterestRequestSchema,
        response: {
          200: RegisterArtworkInterestResponseSchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const subject = requireShopSubject(request);
      const { slug } = request.params as { slug: string };
      const body = (request.body ?? {}) as { intent?: ArtworkInterestIntent };
      const intent = normalizeArtworkInterestIntent(body.intent);
      const status = await deps.registerArtworkInterest({
        artworkSlug: slug,
        identitySubjectId: subject,
        intent,
      });
      if (status === "artwork_not_found") {
        throw notFound("Artwork");
      }
      if (status === "not_subscribable") {
        const message =
          intent === "enquiry"
            ? "This artwork is not accepting enquiries"
            : "This artwork is not accepting availability notifications";
        throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, message, 409);
      }
      return { status };
    },
  );
}
