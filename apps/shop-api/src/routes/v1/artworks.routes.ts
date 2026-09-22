import {
  PublicArtworkDetailSchema,
  PublicArtworkListSchema,
  PublicArtworkSaleStateSchema,
  PublicArtworkSortSchema,
  PublicArtworkTypeFilterSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { CatalogueRoutesDeps } from "../../catalogue-route-deps.js";
import { notFound } from "../../errors/shop-api-error.js";
import { presentArtworkDetail, presentArtworkList } from "../../presenters/catalogue.presenter.js";

const ListQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
  cursor: Type.Optional(Type.String()),
  placement: Type.Optional(
    Type.Union([Type.Literal("featured_originals"), Type.Literal("featured_prints")]),
  ),
  categorySlug: Type.Optional(Type.String({ minLength: 1 })),
  artistSlug: Type.Optional(Type.String({ minLength: 1 })),
  saleState: Type.Optional(PublicArtworkSaleStateSchema),
  editionEligible: Type.Optional(Type.Boolean()),
  type: Type.Optional(PublicArtworkTypeFilterSchema),
  minPrice: Type.Optional(Type.Integer({ minimum: 0 })),
  maxPrice: Type.Optional(Type.Integer({ minimum: 0 })),
  sort: Type.Optional(PublicArtworkSortSchema),
  q: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
});

export async function registerArtworkRoutes(app: FastifyInstance, catalogue: CatalogueRoutesDeps) {
  app.get(
    "/v1/artworks",
    {
      schema: {
        tags: ["catalogue"],
        querystring: ListQuerySchema,
        response: {
          200: PublicArtworkListSchema,
          400: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const query = request.query as {
        limit?: number;
        cursor?: string;
        placement?: "featured_originals" | "featured_prints";
        categorySlug?: string;
        artistSlug?: string;
        saleState?: "for_sale" | "price_on_application" | "sold";
        editionEligible?: boolean;
        type?: "all" | "original" | "edition";
        minPrice?: number;
        maxPrice?: number;
        sort?: "newest" | "titleAsc" | "priceAsc" | "priceDesc";
        q?: string;
      };
      const filter = {
        ...(query.placement !== undefined ? { placement: query.placement } : {}),
        ...(query.categorySlug !== undefined ? { categorySlug: query.categorySlug } : {}),
        ...(query.artistSlug !== undefined ? { artistSlug: query.artistSlug } : {}),
        ...(query.saleState !== undefined ? { saleState: query.saleState } : {}),
        ...(query.editionEligible !== undefined ? { editionEligible: query.editionEligible } : {}),
        ...(query.type !== undefined ? { artworkType: query.type } : {}),
        ...(query.minPrice !== undefined ? { minPricePence: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { maxPricePence: query.maxPrice } : {}),
        ...(query.sort !== undefined ? { sort: query.sort } : {}),
        ...(query.q !== undefined ? { q: query.q } : {}),
      };
      const input = {
        limit: query.limit ?? 20,
        ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
        ...(Object.keys(filter).length > 0 ? { filter } : {}),
      };
      return presentArtworkList(await catalogue.listPublicArtworks(input));
    },
  );

  app.get(
    "/v1/artworks/:slug",
    {
      schema: {
        tags: ["catalogue"],
        params: Type.Object({ slug: Type.String({ minLength: 1 }) }),
        response: {
          200: PublicArtworkDetailSchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const { slug } = request.params as { slug: string };
      const artwork = await catalogue.getPublicArtwork(slug);
      if (!artwork) {
        throw notFound("Artwork not found");
      }
      return presentArtworkDetail(artwork);
    },
  );
}
