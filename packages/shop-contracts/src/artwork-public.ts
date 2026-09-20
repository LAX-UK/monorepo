import { Type } from "@sinclair/typebox";

export const PublicArtworkSaleStateSchema = Type.Union([
  Type.Literal("for_sale"),
  Type.Literal("price_on_application"),
  Type.Literal("sold"),
]);

export const PublicEditionAvailabilitySchema = Type.Object({
  totalEditions: Type.Integer({ minimum: 0 }),
  editionsAvailable: Type.Integer({ minimum: 0 }),
});

export const PublicArtworkSummarySchema = Type.Object(
  {
    slug: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    artistName: Type.String({ minLength: 1 }),
    imageUrl: Type.Union([Type.String({ minLength: 1, maxLength: 2048 }), Type.Null()]),
    saleState: PublicArtworkSaleStateSchema,
    dimensions: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    yearCreated: Type.Union([Type.Integer(), Type.Null()]),
    eligibleForEditionAllocation: Type.Boolean(),
    printPricePence: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    availability: PublicEditionAvailabilitySchema,
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
    description: Type.Union([Type.String(), Type.Null()]),
    imageUrl: Type.Union([Type.String({ minLength: 1, maxLength: 2048 }), Type.Null()]),
    saleState: PublicArtworkSaleStateSchema,
    dimensions: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    yearCreated: Type.Union([Type.Integer(), Type.Null()]),
    eligibleForEditionAllocation: Type.Boolean(),
    printPricePence: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    availability: PublicEditionAvailabilitySchema,
  },
  { additionalProperties: false },
);

export const ShopApiErrorBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
});

export type PublicArtworkSummary = typeof PublicArtworkSummarySchema.static;
export type PublicArtworkList = typeof PublicArtworkListSchema.static;
export type PublicArtworkDetail = typeof PublicArtworkDetailSchema.static;
