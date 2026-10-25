import {
  PublicArtworkDetailSchema,
  PublicArtworkListSchema,
  PublicArtworkObjectTypeFacetListSchema,
  PublicArtworkSaleStateSchema,
  PublicArtworkSalesChannelSchema,
  PublicArtworkSortSchema,
  PublicArtworkTypeFilterSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import {
  ARTWORK_OBJECT_TYPES,
  ARTWORK_RARITIES,
} from "../../application/artwork-catalogue-filters.js";
import type { ArtworkSaleStateFilter } from "../../application/artwork-catalogue-filters.js";
import type { CatalogueRoutesDeps } from "../../catalogue-route-deps.js";
import { notFound } from "../../errors/shop-api-error.js";
import { presentArtworkDetail, presentArtworkList } from "../../presenters/catalogue.presenter.js";

/** One value or a comma-separated list of `values` (e.g. `painting,print`); matches any of them. */
function commaListOf(values: readonly string[]) {
  const one = `(?:${values.join("|")})`;
  return Type.String({ pattern: `^${one}(?:,${one})*$` });
}

/** Comma-separated query value as a list; empty segments are dropped. */
function splitCommaList(value: string): string[] {
  return value.split(",").filter((part) => part.length > 0);
}

const ListQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
  cursor: Type.Optional(Type.String()),
  placement: Type.Optional(
    Type.Union([Type.Literal("featured_originals"), Type.Literal("featured_prints")]),
  ),
  categorySlug: Type.Optional(Type.String({ minLength: 1 })),
  /** One slug or a comma-separated list. */
  artistSlug: Type.Optional(Type.String({ minLength: 1, maxLength: 2048 })),
  relatedTo: Type.Optional(Type.String({ minLength: 1 })),
  /** Editions made from the original with this slug ("Editions available in LAX Shop"). */
  sourceOriginal: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  objectType: Type.Optional(commaListOf(ARTWORK_OBJECT_TYPES)),
  rarity: Type.Optional(commaListOf(ARTWORK_RARITIES)),
  salesChannel: Type.Optional(PublicArtworkSalesChannelSchema),
  saleState: Type.Optional(
    Type.Union([PublicArtworkSaleStateSchema, Type.Literal("available")], {
      description: "`available` returns every work that is not sold (for sale or POA).",
    }),
  ),
  editionEligible: Type.Optional(Type.Boolean()),
  type: Type.Optional(PublicArtworkTypeFilterSchema),
  minPrice: Type.Optional(Type.Integer({ minimum: 0 })),
  maxPrice: Type.Optional(Type.Integer({ minimum: 0 })),
  sort: Type.Optional(PublicArtworkSortSchema),
  q: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
});

/** The Shop channel sells limited editions only; originals are served to the lax.art channel. */
function isShopChannel(salesChannel: "shop" | "art" | undefined): boolean {
  return salesChannel === "shop";
}

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
        relatedTo?: string;
        sourceOriginal?: string;
        objectType?: string;
        rarity?: string;
        salesChannel?: "shop" | "art";
        saleState?: ArtworkSaleStateFilter;
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
        ...(query.artistSlug !== undefined
          ? { artistSlugs: splitCommaList(query.artistSlug) }
          : {}),
        ...(query.relatedTo !== undefined ? { relatedToSlug: query.relatedTo } : {}),
        ...(query.sourceOriginal !== undefined ? { sourceOriginalSlug: query.sourceOriginal } : {}),
        ...(query.objectType !== undefined
          ? { objectTypes: splitCommaList(query.objectType) }
          : {}),
        ...(query.rarity !== undefined ? { rarities: splitCommaList(query.rarity) } : {}),
        ...(query.salesChannel !== undefined ? { salesChannel: query.salesChannel } : {}),
        ...(query.saleState !== undefined ? { saleState: query.saleState } : {}),
        ...(query.editionEligible !== undefined ? { editionEligible: query.editionEligible } : {}),
        ...(isShopChannel(query.salesChannel)
          ? { artworkType: "edition" as const }
          : query.type !== undefined
            ? { artworkType: query.type }
            : {}),
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
    "/v1/artwork-object-types",
    {
      schema: {
        tags: ["catalogue"],
        querystring: Type.Object({ salesChannel: PublicArtworkSalesChannelSchema }),
        response: {
          200: PublicArtworkObjectTypeFacetListSchema,
          400: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const { salesChannel } = request.query as { salesChannel: "shop" | "art" };
      return { items: await catalogue.listArtworkObjectTypeFacets(salesChannel) };
    },
  );

  app.get(
    "/v1/artworks/:slug",
    {
      schema: {
        tags: ["catalogue"],
        params: Type.Object({ slug: Type.String({ minLength: 1 }) }),
        querystring: Type.Object({
          salesChannel: Type.Optional(PublicArtworkSalesChannelSchema),
        }),
        response: {
          200: PublicArtworkDetailSchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const { slug } = request.params as { slug: string };
      const { salesChannel } = request.query as { salesChannel?: "shop" | "art" };
      const artwork = await catalogue.getPublicArtwork(slug);
      if (
        !artwork ||
        (salesChannel !== undefined && artwork.salesChannel !== salesChannel) ||
        (isShopChannel(salesChannel) && !artwork.eligibleForEditionAllocation)
      ) {
        throw notFound("Artwork not found");
      }
      return presentArtworkDetail(artwork);
    },
  );
}
