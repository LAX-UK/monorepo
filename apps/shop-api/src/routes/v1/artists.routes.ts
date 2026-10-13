import {
  PublicArtistDetailSchema,
  PublicArtistListSchema,
  PublicArtistSortSchema,
  PublicArtworkSalesChannelSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { CatalogueRoutesDeps } from "../../catalogue-route-deps.js";
import { notFound } from "../../errors/shop-api-error.js";
import { presentArtistDetail, presentArtistList } from "../../presenters/catalogue.presenter.js";

const ListQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
  cursor: Type.Optional(Type.String()),
  placement: Type.Optional(Type.Literal("featured_artists")),
  q: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
  letter: Type.Optional(Type.String({ pattern: "^[A-Za-z]$" })),
  sort: Type.Optional(PublicArtistSortSchema),
  salesChannel: Type.Optional(PublicArtworkSalesChannelSchema),
});

export async function registerArtistRoutes(app: FastifyInstance, catalogue: CatalogueRoutesDeps) {
  app.get(
    "/v1/artists",
    {
      schema: {
        tags: ["catalogue"],
        querystring: ListQuerySchema,
        response: {
          200: PublicArtistListSchema,
          400: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const query = request.query as {
        limit?: number;
        cursor?: string;
        placement?: "featured_artists";
        q?: string;
        letter?: string;
        sort?: "newest" | "nameAsc" | "nameDesc";
        salesChannel?: "shop" | "art";
      };
      const input = {
        limit: query.limit ?? 20,
        ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
        ...(query.placement !== undefined ? { placement: query.placement } : {}),
        ...(query.q !== undefined ? { q: query.q } : {}),
        ...(query.letter !== undefined ? { letter: query.letter } : {}),
        ...(query.sort !== undefined ? { sort: query.sort } : {}),
        ...(query.salesChannel !== undefined ? { salesChannel: query.salesChannel } : {}),
      };
      return presentArtistList(await catalogue.listPublicArtists(input));
    },
  );

  app.get(
    "/v1/artists/:slug",
    {
      schema: {
        tags: ["catalogue"],
        params: Type.Object({ slug: Type.String({ minLength: 1 }) }),
        response: {
          200: PublicArtistDetailSchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const { slug } = request.params as { slug: string };
      const artist = await catalogue.getPublicArtist(slug);
      if (!artist) {
        throw notFound("Artist not found");
      }
      return presentArtistDetail(artist);
    },
  );
}
