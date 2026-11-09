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

/**
 * Public availability is a state, never a remaining count: shoppers see the edition size and
 * whether the work is available or sold out. Counts are for LAX staff and the original's owner,
 * from their own authorised endpoints.
 */
export const PublicAvailabilityStateSchema = Type.Union([
  Type.Literal("available"),
  Type.Literal("sold_out"),
]);

export const PublicEditionAvailabilitySchema = Type.Object(
  {
    /** The edition size ("Limited edition of 24"); 0 for works with no edition series. */
    totalEditions: Type.Integer({ minimum: 0 }),
    state: PublicAvailabilityStateSchema,
  },
  { additionalProperties: false },
);

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
    /**
     * When the work was first listed, which the storefront uses to mark new releases. Optional so
     * storefronts parse responses from an older shop-api.
     */
    listedAt: Type.Optional(Type.String({ format: "date-time" })),
    /**
     * The one line a shop card shows about an edition run, e.g. "Limited edition of 25 · Hand-signed",
     * written by shop-domain from the confirmed facts. Null for originals and while no facts are
     * confirmed. Never a remaining count. Optional so storefronts parse an older shop-api.
     */
    editionCardLine: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
    /**
     * The slug of the listing every version of one work hangs from: the main run's slug for a
     * proof or companion listing, the listing's own slug otherwise. Storefronts show one card per
     * work by grouping on it. Optional so storefronts parse an older shop-api.
     */
    workSlug: Type.Optional(Type.String({ minLength: 1 })),
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

const PublicProofTypeSchema = Type.Union([
  Type.Literal("ap"),
  Type.Literal("pp"),
  Type.Literal("hc"),
]);

/** A run as a storefront may know it: its kind and size, never its allocation or splits. */
export const PublicEditionRunSchema = Type.Union([
  Type.Object(
    { kind: Type.Literal("limited"), size: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false },
  ),
  Type.Object({ kind: Type.Literal("open") }, { additionalProperties: false }),
  Type.Object(
    {
      kind: Type.Literal("proof"),
      proofType: PublicProofTypeSchema,
      size: Type.Integer({ minimum: 1 }),
    },
    { additionalProperties: false },
  ),
]);

const PublicSignaturePlaceSchema = Type.Union([
  Type.Literal("front_lower_margin"),
  Type.Literal("back"),
]);

const PublicSignatureSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("hand_signed"),
      medium: Type.Union([Type.Literal("pencil"), Type.Literal("ink")]),
      place: PublicSignaturePlaceSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object({ kind: Type.Literal("plate_signed") }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal("estate_stamped") }, { additionalProperties: false }),
  Type.Object(
    { kind: Type.Literal("estate_signed"), place: PublicSignaturePlaceSchema },
    { additionalProperties: false },
  ),
  Type.Object({ kind: Type.Literal("unsigned") }, { additionalProperties: false }),
]);

const PublicCertificateSchema = Type.Union([
  Type.Object({ kind: Type.Literal("none") }, { additionalProperties: false }),
  Type.Object(
    {
      kind: Type.Literal("included"),
      issuer: Type.Union([Type.Literal("artist"), Type.Literal("publisher"), Type.Literal("lax")]),
      form: Type.Union([Type.Literal("paper"), Type.Literal("digital"), Type.Literal("both")]),
      arrives: Type.Union([
        Type.Object({ kind: Type.Literal("with_print") }, { additionalProperties: false }),
        Type.Object(
          { kind: Type.Literal("separately"), withinWeeks: Type.Integer({ minimum: 1 }) },
          { additionalProperties: false },
        ),
      ]),
      numberedToMatch: Type.Boolean(),
      /** Who gave the written authority behind a London Art Exchange certificate; nothing more. */
      authority: Type.Optional(
        Type.Object(
          { givenBy: Type.Union([Type.Literal("artist"), Type.Literal("estate")]) },
          { additionalProperties: false },
        ),
      ),
    },
    { additionalProperties: false },
  ),
]);

/** The facts staff confirmed about a run. Every sentence about them is written by shop-domain. */
export const PublicEditionFactsSchema = Type.Object(
  {
    numbering: Type.Union([
      Type.Literal("on_print"),
      Type.Literal("on_certificate"),
      Type.Literal("none"),
    ]),
    signature: PublicSignatureSchema,
    certificate: PublicCertificateSchema,
    stamp: Type.Optional(
      Type.Union([
        Type.Literal("none"),
        Type.Literal("publisher_blind"),
        Type.Literal("printer_blind"),
        Type.Literal("estate_back"),
      ]),
    ),
    printedBy: Type.Optional(Type.Union([Type.String({ maxLength: 80 }), Type.Null()])),
    publishedBy: Type.Optional(
      Type.Union([
        Type.Object({ kind: Type.Literal("artist") }, { additionalProperties: false }),
        Type.Object({ kind: Type.Literal("lax") }, { additionalProperties: false }),
        Type.Object(
          { kind: Type.Literal("named"), name: Type.String({ minLength: 1, maxLength: 80 }) },
          { additionalProperties: false },
        ),
        Type.Null(),
      ]),
    ),
  },
  { additionalProperties: false },
);

/** Another run of the same image, listed beside this one: a proof, an open run or a companion. */
export const PublicOtherRunSchema = Type.Object(
  {
    slug: Type.String({ minLength: 1 }),
    run: PublicEditionRunSchema,
    facts: Type.Union([PublicEditionFactsSchema, Type.Null()]),
    printPricePence: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    availability: PublicAvailabilityStateSchema,
  },
  { additionalProperties: false },
);

/** The run behind an edition page, its confirmed facts and the other runs of the same image. */
export const PublicArtworkEditionSchema = Type.Object(
  {
    run: PublicEditionRunSchema,
    /** Null until staff confirm the facts; a page then names the run and says no more. */
    facts: Type.Union([PublicEditionFactsSchema, Type.Null()]),
    /** Proofs the main run kept outside the edition; never the BAT proof. */
    proofsKept: Type.Union([
      Type.Object(
        {
          ap: Type.Integer({ minimum: 0 }),
          pp: Type.Integer({ minimum: 0 }),
          hc: Type.Integer({ minimum: 0 }),
        },
        { additionalProperties: false },
      ),
      Type.Null(),
    ]),
    otherRuns: Type.Array(PublicOtherRunSchema),
  },
  { additionalProperties: false },
);

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
    /** Paper the edition is printed on, as catalogued (e.g. "Somerset Satin 410gsm"). */
    printPaper: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
    /** Sheet size of the print, as catalogued, when it differs from the image size. */
    printSize: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
    /**
     * For an edition: the slug of the original it was made from, while that original is on
     * lax.art. Null or absent when there is none to link to.
     */
    sourceOriginalSlug: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
    provenance: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    exhibitionHistory: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    salesChannel: PublicArtworkSalesChannelSchema,
    eligibleForEditionAllocation: Type.Boolean(),
    printPricePence: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    availability: PublicEditionAvailabilitySchema,
    /** Optional so storefronts parse responses from an older shop-api; absent for an original. */
    edition: Type.Optional(Type.Union([PublicArtworkEditionSchema, Type.Null()])),
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

/** Catalogue availability filter: can be bought now, or sold out. */
export const PublicArtworkAvailabilityFilterSchema = Type.Union([
  Type.Literal("available"),
  Type.Literal("sold_out"),
]);

const FacetCount = Type.Integer({ minimum: 0 });

const BandFacetCount = Type.Object(
  { key: Type.String({ minLength: 1 }), count: FacetCount },
  { additionalProperties: false },
);

/**
 * Counts beside each catalogue filter option. A group is counted with the other filters applied
 * but not its own; options with no works are left out.
 */
export const PublicArtworkFacetCountsSchema = Type.Object(
  {
    availability: Type.Object(
      { available: FacetCount, soldOut: FacetCount },
      { additionalProperties: false },
    ),
    categories: Type.Array(
      Type.Object(
        { slug: Type.String({ minLength: 1 }), label: Type.String(), count: FacetCount },
        { additionalProperties: false },
      ),
    ),
    artists: Type.Array(
      Type.Object(
        { slug: Type.String({ minLength: 1 }), name: Type.String(), count: FacetCount },
        { additionalProperties: false },
      ),
    ),
    // The band and technique groups stay optional so storefronts parse an older shop-api.
    /** Works per price band (`CATALOGUE_PRICE_BANDS`), in band order; empty bands included. */
    priceBands: Type.Optional(Type.Array(BandFacetCount)),
    /** Works per size band (`CATALOGUE_SIZE_BANDS`) by the longest side; empty bands included. */
    sizes: Type.Optional(Type.Array(BandFacetCount)),
    /** Works per technique (the catalogued medium), most works first. */
    techniques: Type.Optional(
      Type.Array(
        Type.Object(
          { value: Type.String({ minLength: 1 }), count: FacetCount },
          { additionalProperties: false },
        ),
      ),
    ),
    /** Works per object type (the medium on lax.art); only types with works. */
    objectTypes: Type.Optional(Type.Array(BandFacetCount)),
    /** Works per sale state (`for_sale`, `price_on_application`, `sold`); only states with works. */
    saleStates: Type.Optional(Type.Array(BandFacetCount)),
  },
  { additionalProperties: false },
);

export type PublicArtworkFacetCounts = typeof PublicArtworkFacetCountsSchema.static;

export const ShopApiErrorBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
});

export type PublicArtworkSummary = typeof PublicArtworkSummarySchema.static;
export type PublicArtworkList = typeof PublicArtworkListSchema.static;
export type PublicArtworkEdition = typeof PublicArtworkEditionSchema.static;
export type PublicOtherRun = typeof PublicOtherRunSchema.static;
export type PublicArtworkDetail = typeof PublicArtworkDetailSchema.static;
export type PublicArtworkObjectTypeFacet = typeof PublicArtworkObjectTypeFacetSchema.static;
export type PublicArtworkObjectTypeFacetList = typeof PublicArtworkObjectTypeFacetListSchema.static;
