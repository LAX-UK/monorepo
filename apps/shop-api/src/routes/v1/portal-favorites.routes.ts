import {
  PortalFavoriteMutationResponseSchema,
  PortalFollowedArtistsResponseSchema,
  PortalSavedArtworksResponseSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type {
  PortalFavoriteMutationResult,
  PortalFavoritesHandlers,
} from "../../application/handlers/portal-favorites.handler.js";
import { notFound } from "../../errors/shop-api-error.js";
import { requireShopScope, requireShopSubject } from "../../plugins/shop-auth.js";

const SlugParamsSchema = Type.Object({ slug: Type.String({ minLength: 1, maxLength: 200 }) });

const mutationSchema = {
  tags: ["shop-portal"],
  params: SlugParamsSchema,
  response: {
    200: PortalFavoriteMutationResponseSchema,
    401: ShopApiErrorBodySchema,
    403: ShopApiErrorBodySchema,
    404: ShopApiErrorBodySchema,
  },
};

function toMutationResponse(result: PortalFavoriteMutationResult, resource: string) {
  if (result === "not_found") {
    throw notFound(resource);
  }
  return { status: result };
}

export async function registerPortalFavoritesRoutes(
  app: FastifyInstance,
  favorites: PortalFavoritesHandlers,
): Promise<void> {
  app.get(
    "/v1/me/favorites/artworks",
    {
      schema: {
        tags: ["shop-portal"],
        response: {
          200: PortalSavedArtworksResponseSchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      return { items: await favorites.listSavedArtworks(subject) };
    },
  );

  app.put("/v1/me/favorites/artworks/:slug", { schema: mutationSchema }, async (request) => {
    requireShopScope(request, "shop.write");
    const subject = requireShopSubject(request);
    const { slug } = request.params as { slug: string };
    return toMutationResponse(await favorites.saveArtwork(subject, slug), "Artwork");
  });

  app.delete("/v1/me/favorites/artworks/:slug", { schema: mutationSchema }, async (request) => {
    requireShopScope(request, "shop.write");
    const subject = requireShopSubject(request);
    const { slug } = request.params as { slug: string };
    return toMutationResponse(await favorites.unsaveArtwork(subject, slug), "Artwork");
  });

  app.get(
    "/v1/me/favorites/artists",
    {
      schema: {
        tags: ["shop-portal"],
        response: {
          200: PortalFollowedArtistsResponseSchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      return { items: await favorites.listFollowedArtists(subject) };
    },
  );

  app.put("/v1/me/favorites/artists/:slug", { schema: mutationSchema }, async (request) => {
    requireShopScope(request, "shop.write");
    const subject = requireShopSubject(request);
    const { slug } = request.params as { slug: string };
    return toMutationResponse(await favorites.followArtist(subject, slug), "Artist");
  });

  app.delete("/v1/me/favorites/artists/:slug", { schema: mutationSchema }, async (request) => {
    requireShopScope(request, "shop.write");
    const subject = requireShopSubject(request);
    const { slug } = request.params as { slug: string };
    return toMutationResponse(await favorites.unfollowArtist(subject, slug), "Artist");
  });
}
