import { Type } from "@sinclair/typebox";
import { PublicSeoFieldsProperties } from "./seo-fields.js";

export const PublicArtworkSaleStateSchema = Type.Union([
  Type.Literal("for_sale"),
  Type.Literal("price_on_application"),
  Type.Literal("sold"),
]);

export const PublicArtworkSalesChannelSchema = Type.Union([
  Type.Literal("shop"),
  Type.Literal("art"),
]);

export const PublicEditionAvailabilitySchema = Type.Object({
  totalEditions: Type.Integer({ minimum: 0 }),
  editionsAvailable: Type.Integer({ minimum: 0 }),
});

export const PublicArtworkObjectTypeSchema = Type.Union([
  Type.Literal("painting"),
  Type.Literal("work_on_paper"),
  Type.Literal("sculpture"),
  Type.Literal("photography"),
  Type.Literal("print"),
  Type.Literal("mixed_media"),
]);

export const PublicArtworkRaritySchema = Type.Union([
  Type.Literal("unique"),
  Type.Literal("limited_edition"),
  Type.Literal("open_edition"),
]);

export const PublicArtworkImageSchema = Type.Object({
  url: Type.String({ minLength: 1, maxLength: 2048 }),
  alt: Type.Union([Type.String({ maxLength: 500 }), Type.Null()]),
  caption: Type.Union([Type.String({ maxLength: 1000 }), Type.Null()]),
  blurDataUrl: Type.Union([Type.String(), Type.Null()]),
});

export const PublicArtworkSummarySchema = Type.Object(
  {
    slug: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    artistName: Type.String({ minLength: 1 }),
    artistSlug: Type.String({ minLength: 1 }),
    imageUrl: Type.Union([Type.String({ minLength: 1, maxLength: 2048 }), Type.Null()]),
    saleState: PublicArtworkSaleStateSchema,
    dimensions: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    // 0215 fields stay optional so storefronts parse responses from an older shop-api.
    dimensionsCmDisplay: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
    medium: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    yearCreated: Type.Union([Type.Integer(), Type.Null()]),
    objectType: Type.Optional(Type.Union([PublicArtworkObjectTypeSchema, Type.Null()])),
    rarity: Type.Optional(Type.Union([PublicArtworkRaritySchema, Type.Null()])),
    salesChannel: PublicArtworkSalesChannelSchema,
    eligibleForEditionAllocation: Type.Boolean(),
    printPricePence: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    availability: PublicEditionAvailabilitySchema,
    /** Sitemap `lastmod`; optional so storefronts parse responses from an older shop-api. */
    updatedAt: Type.Optional(Type.String({ format: "date-time" })),
  },
  { additionalProperties: false },
);

export const PublicArtworkSortSchema = Type.Union([
  Type.Literal("newest"),
  Type.Literal("titleAsc"),
  Type.Literal("priceAsc"),
  Type.Literal("priceDesc"),
]);

export const PublicArtworkTypeFilterSchema = Type.Union([
  Type.Literal("all"),
  Type.Literal("original"),
  Type.Literal("edition"),
]);

export const PublicArtworkListSchema = Type.Object({
  items: Type.Array(PublicArtworkSummarySchema),
  nextCursor: Type.Optional(Type.String()),
  totalCount: Type.Optional(Type.Integer({ minimum: 0 })),
});

export const PublicArtworkDetailSchema = Type.Object(
  {
    slug: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    artistName: Type.String({ minLength: 1 }),
    artistSlug: Type.String({ minLength: 1 }),
    description: Type.Union([Type.String(), Type.Null()]),
    imageUrl: Type.Union([Type.String({ minLength: 1, maxLength: 2048 }), Type.Null()]),
    // 0215 fields stay optional so storefronts parse responses from an older shop-api.
    images: Type.Optional(Type.Array(PublicArtworkImageSchema)),
    saleState: PublicArtworkSaleStateSchema,
    dimensions: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    dimensionsCmDisplay: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
    heightCm: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    widthCm: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    depthCm: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    medium: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    yearCreated: Type.Union([Type.Integer(), Type.Null()]),
    objectType: Type.Optional(Type.Union([PublicArtworkObjectTypeSchema, Type.Null()])),
    rarity: Type.Optional(Type.Union([PublicArtworkRaritySchema, Type.Null()])),
    hasCertificate: Type.Optional(Type.Boolean()),
    provenance: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    exhibitionHistory: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    salesChannel: PublicArtworkSalesChannelSchema,
    eligibleForEditionAllocation: Type.Boolean(),
    printPricePence: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    availability: PublicEditionAvailabilitySchema,
    ...PublicSeoFieldsProperties,
  },
  { additionalProperties: false },
);

/** Medium tiles: object types with published works on a channel, newest cover first. */
export const PublicArtworkObjectTypeFacetSchema = Type.Object(
  {
    objectType: PublicArtworkObjectTypeSchema,
    artworkCount: Type.Integer({ minimum: 1 }),
    coverImageUrl: Type.Union([Type.String({ minLength: 1, maxLength: 2048 }), Type.Null()]),
  },
  { additionalProperties: false },
);

export const PublicArtworkObjectTypeFacetListSchema = Type.Object({
  items: Type.Array(PublicArtworkObjectTypeFacetSchema),
});

export const ShopApiErrorBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
});

export type PublicArtworkSummary = typeof PublicArtworkSummarySchema.static;
export type PublicArtworkList = typeof PublicArtworkListSchema.static;
export type PublicArtworkDetail = typeof PublicArtworkDetailSchema.static;
export type PublicArtworkObjectTypeFacet = typeof PublicArtworkObjectTypeFacetSchema.static;
export type PublicArtworkObjectTypeFacetList = typeof PublicArtworkObjectTypeFacetListSchema.static;
