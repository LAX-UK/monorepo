import { type Static, Type } from "@sinclair/typebox";
import { createCursorListResponseSchema } from "./cursor-list.js";
import { SEO_DESCRIPTION_MAX_LENGTH, SEO_TITLE_MAX_LENGTH } from "./seo-fields.js";

/**
 * Staff catalogue contracts for artworks and artists. These responses carry edition counts
 * (sold, reserved, held) because staff manage the run; public catalogue responses never do and
 * show only `available` or `sold_out`.
 */

/** Lower-case words joined by single hyphens, so every slug is a clean URL segment. */
export const CATALOGUE_SLUG_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
export const CATALOGUE_SLUG_MAX_LENGTH = 120;

export const ARTWORK_TITLE_MAX_LENGTH = 200;
export const ARTWORK_MEDIUM_MAX_LENGTH = 200;
export const ARTWORK_DIMENSIONS_MAX_LENGTH = 200;
export const ARTWORK_DESCRIPTION_MAX_LENGTH = 10_000;
export const ARTWORK_IMAGE_ALT_MAX_LENGTH = 500;
export const ARTWORK_IMAGES_MAX = 20;
export const ARTWORK_YEAR_MIN = 1000;
export const ARTWORK_YEAR_MAX = 2100;
/** £100,000 in pence: far above any edition, and well inside the integer column. */
export const ARTWORK_EDITION_PRICE_MAX_PENCE = 10_000_000;
export const ARTWORK_LIST_SEARCH_MAX_LENGTH = 100;
export const ARTWORK_BULK_MAX = 100;

export const ARTIST_NAME_MAX_LENGTH = 200;
export const ARTIST_DISCIPLINE_MAX_LENGTH = 120;

/** 409 messages for a taken slug; the editor matches them to show the error on the slug field. */
export const ARTWORK_SLUG_IN_USE_MESSAGE = "That slug is already used by another artwork.";
export const ARTIST_SLUG_IN_USE_MESSAGE = "That slug is already used by another artist.";

export const AdminArtworkStateSchema = Type.Union([
  Type.Literal("live"),
  Type.Literal("draft"),
  Type.Literal("sold_out"),
  Type.Literal("archived"),
]);
export type AdminArtworkState = Static<typeof AdminArtworkStateSchema>;
export const ADMIN_ARTWORK_STATES = ["live", "draft", "sold_out", "archived"] as const;

export const AdminArtworkSaleStateSchema = Type.Union([
  Type.Literal("for_sale"),
  Type.Literal("price_on_application"),
  Type.Literal("sold"),
]);
export type AdminArtworkSaleState = Static<typeof AdminArtworkSaleStateSchema>;
export const ADMIN_ARTWORK_SALE_STATES = ["for_sale", "price_on_application", "sold"] as const;

export const AdminArtworkChannelSchema = Type.Union([Type.Literal("shop"), Type.Literal("art")]);
export type AdminArtworkChannel = Static<typeof AdminArtworkChannelSchema>;
export const ADMIN_ARTWORK_CHANNELS = ["shop", "art"] as const;

/** A row's `updatedAt`, handed back as `expectedVersion` so a stale save is refused. */
export const CatalogueVersionSchema = Type.String({ format: "date-time", maxLength: 40 });

const SlugSchema = Type.String({
  minLength: 1,
  maxLength: CATALOGUE_SLUG_MAX_LENGTH,
  pattern: CATALOGUE_SLUG_PATTERN,
});
const NullableText = (maxLength: number) => Type.Union([Type.String({ maxLength }), Type.Null()]);
/**
 * Whole pence for one edition. Omitted, not null, when there is no price: the API coerces types,
 * and a nullable integer would quietly turn 0 into "no price" instead of refusing it.
 */
const PricePenceSchema = Type.Integer({ minimum: 1, maximum: ARTWORK_EDITION_PRICE_MAX_PENCE });
const SeoTitleSchema = NullableText(SEO_TITLE_MAX_LENGTH);
const SeoDescriptionSchema = NullableText(SEO_DESCRIPTION_MAX_LENGTH);

export const AdminArtworkImageInputSchema = Type.Object(
  {
    /** A confirmed upload from `POST /media/confirm` (kind `artwork_image`). */
    mediaKey: Type.String({ minLength: 1, maxLength: 512 }),
    alt: NullableText(ARTWORK_IMAGE_ALT_MAX_LENGTH),
  },
  { additionalProperties: false },
);

/** The fields staff edit after creation. The slug and the edition run are fixed at creation. */
const EditableArtworkFields = {
  title: Type.String({ minLength: 1, maxLength: ARTWORK_TITLE_MAX_LENGTH }),
  artistId: Type.String({ format: "uuid" }),
  yearCreated: Type.Union([
    Type.Integer({ minimum: ARTWORK_YEAR_MIN, maximum: ARTWORK_YEAR_MAX }),
    Type.Null(),
  ]),
  medium: NullableText(ARTWORK_MEDIUM_MAX_LENGTH),
  dimensions: NullableText(ARTWORK_DIMENSIONS_MAX_LENGTH),
  description: NullableText(ARTWORK_DESCRIPTION_MAX_LENGTH),
  /** Omitted for an original, or while an edition run has no price yet. */
  printPricePence: Type.Optional(PricePenceSchema),
  saleState: AdminArtworkSaleStateSchema,
  salesChannel: AdminArtworkChannelSchema,
  /** In display order; the first is the primary image. */
  images: Type.Array(AdminArtworkImageInputSchema, { maxItems: ARTWORK_IMAGES_MAX }),
  /**
   * For an edition: the original artwork it was made from. Null clears the link; omitted leaves
   * it as it is, so an older client never clears it by accident.
   */
  sourceOriginalArtworkId: Type.Optional(
    Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  ),
  seoTitle: SeoTitleSchema,
  seoDescription: SeoDescriptionSchema,
};

export const AdminArtworkCreateBodySchema = Type.Object(
  {
    slug: SlugSchema,
    /** True plans the run of 24 editions (10 buyer entitlement, 10 artist, 4 LAX). */
    eligibleForEditionAllocation: Type.Boolean(),
    ...EditableArtworkFields,
  },
  { additionalProperties: false },
);
export type AdminArtworkCreateBody = Static<typeof AdminArtworkCreateBodySchema>;

export const AdminArtworkCreateResponseSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  version: CatalogueVersionSchema,
});

export const AdminArtworkUpdateBodySchema = Type.Object(
  { ...EditableArtworkFields, expectedVersion: CatalogueVersionSchema },
  { additionalProperties: false },
);
export type AdminArtworkUpdateBody = Static<typeof AdminArtworkUpdateBodySchema>;

/**
 * The edition price alone, for staff who may set prices but not edit the catalogue. Omitted
 * clears the price.
 */
export const AdminArtworkPriceBodySchema = Type.Object(
  {
    printPricePence: Type.Optional(PricePenceSchema),
    expectedVersion: CatalogueVersionSchema,
  },
  { additionalProperties: false },
);
export type AdminArtworkPriceBody = Static<typeof AdminArtworkPriceBodySchema>;

export const ADMIN_ARTWORK_VISIBILITY_ACTIONS = [
  "publish",
  "unpublish",
  "archive",
  "restore",
] as const;
export const AdminArtworkVisibilityActionSchema = Type.Union(
  ADMIN_ARTWORK_VISIBILITY_ACTIONS.map((action) => Type.Literal(action)),
);
export type AdminArtworkVisibilityAction = (typeof ADMIN_ARTWORK_VISIBILITY_ACTIONS)[number];

export const AdminArtworkVersionResponseSchema = Type.Object({
  version: CatalogueVersionSchema,
  state: AdminArtworkStateSchema,
});
export type AdminArtworkVersionResponse = Static<typeof AdminArtworkVersionResponseSchema>;

export const AdminArtworkBulkVisibilityBodySchema = Type.Object(
  {
    action: AdminArtworkVisibilityActionSchema,
    artworkIds: Type.Array(Type.String({ format: "uuid" }), {
      minItems: 1,
      maxItems: ARTWORK_BULK_MAX,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);
export type AdminArtworkBulkVisibilityBody = Static<typeof AdminArtworkBulkVisibilityBodySchema>;

export const AdminArtworkBulkOutcomeSchema = Type.Union([
  Type.Literal("changed"),
  Type.Literal("unchanged"),
  Type.Literal("refused"),
  Type.Literal("not_found"),
]);

/** One result per requested artwork: a refusal (e.g. no image to publish) never blocks the rest. */
export const AdminArtworkBulkVisibilityResponseSchema = Type.Object({
  results: Type.Array(
    Type.Object({
      artworkId: Type.String({ format: "uuid" }),
      outcome: AdminArtworkBulkOutcomeSchema,
      message: Type.Optional(Type.String()),
    }),
  ),
});
export type AdminArtworkBulkVisibilityResponse = Static<
  typeof AdminArtworkBulkVisibilityResponseSchema
>;

/** Artwork list sorts; the first is the default. */
export const ADMIN_ARTWORK_SORTS = ["updated_desc", "updated_asc"] as const;
export type AdminArtworkSort = (typeof ADMIN_ARTWORK_SORTS)[number];

export const AdminArtworkListQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String({ maxLength: 512 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  /** Title or artist name. */
  q: Type.Optional(Type.String({ maxLength: ARTWORK_LIST_SEARCH_MAX_LENGTH })),
  state: Type.Optional(AdminArtworkStateSchema),
  artistId: Type.Optional(Type.String({ format: "uuid" })),
  saleState: Type.Optional(AdminArtworkSaleStateSchema),
  salesChannel: Type.Optional(AdminArtworkChannelSchema),
  /** Last changed first by default; the artwork id breaks ties. */
  sort: Type.Optional(Type.Union(ADMIN_ARTWORK_SORTS.map((sort) => Type.Literal(sort)))),
});
export type AdminArtworkListQuery = Static<typeof AdminArtworkListQuerySchema>;

export const AdminArtworkListItemSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  title: Type.String(),
  artistId: Type.String({ format: "uuid" }),
  artistName: Type.String(),
  thumbnailUrl: Type.Union([Type.String(), Type.Null()]),
  /** 24 for an edition run, 0 for an original. */
  editionSize: Type.Integer({ minimum: 0 }),
  soldEditionCount: Type.Integer({ minimum: 0 }),
  printPricePence: Type.Union([Type.Integer(), Type.Null()]),
  saleState: AdminArtworkSaleStateSchema,
  salesChannel: AdminArtworkChannelSchema,
  state: AdminArtworkStateSchema,
  updatedAt: Type.String({ format: "date-time" }),
});
export type AdminArtworkListItem = Static<typeof AdminArtworkListItemSchema>;

export const AdminArtworkListSchema = Type.Intersect([
  createCursorListResponseSchema(AdminArtworkListItemSchema),
  Type.Object({
    /** Matches per state under every filter except `state`, for the view tabs. */
    counts: Type.Object({
      live: Type.Integer({ minimum: 0 }),
      draft: Type.Integer({ minimum: 0 }),
      sold_out: Type.Integer({ minimum: 0 }),
      archived: Type.Integer({ minimum: 0 }),
    }),
  }),
]);
export type AdminArtworkList = Static<typeof AdminArtworkListSchema>;

const StatusCountsSchema = Type.Object({
  not_authorised: Type.Integer({ minimum: 0 }),
  authorised: Type.Integer({ minimum: 0 }),
  reserved: Type.Integer({ minimum: 0 }),
  held: Type.Integer({ minimum: 0 }),
  sold: Type.Integer({ minimum: 0 }),
  withdrawn: Type.Integer({ minimum: 0 }),
});
const AllocationCountsSchema = Type.Object({
  original_buyer_entitlement: Type.Integer({ minimum: 0 }),
  artist: Type.Integer({ minimum: 0 }),
  lax: Type.Integer({ minimum: 0 }),
});

export const AdminArtworkPublishBlockerSchema = Type.Union([
  Type.Literal("archived"),
  Type.Literal("artist_archived"),
  Type.Literal("no_image"),
  Type.Literal("no_edition_price"),
]);

export const AdminArtworkDetailSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  title: Type.String(),
  artist: Type.Object({
    artistId: Type.String({ format: "uuid" }),
    slug: Type.String(),
    displayName: Type.String(),
    archived: Type.Boolean(),
  }),
  yearCreated: Type.Union([Type.Integer(), Type.Null()]),
  medium: Type.Union([Type.String(), Type.Null()]),
  dimensions: Type.Union([Type.String(), Type.Null()]),
  description: Type.Union([Type.String(), Type.Null()]),
  eligibleForEditionAllocation: Type.Boolean(),
  printPricePence: Type.Union([Type.Integer(), Type.Null()]),
  saleState: AdminArtworkSaleStateSchema,
  salesChannel: AdminArtworkChannelSchema,
  seoTitle: Type.Union([Type.String(), Type.Null()]),
  seoDescription: Type.Union([Type.String(), Type.Null()]),
  images: Type.Array(
    Type.Object({
      mediaKey: Type.String(),
      url: Type.Union([Type.String(), Type.Null()]),
      alt: Type.Union([Type.String(), Type.Null()]),
    }),
  ),
  /** An image URL from an earlier import, shown until images are uploaded here. */
  importedImageUrl: Type.Union([Type.String(), Type.Null()]),
  /** The original an edition was made from; absent from an older shop-api. */
  sourceOriginal: Type.Optional(
    Type.Union([
      Type.Object({
        artworkId: Type.String({ format: "uuid" }),
        slug: Type.String(),
        title: Type.String(),
      }),
      Type.Null(),
    ]),
  ),
  editions: Type.Object({
    size: Type.Integer({ minimum: 0 }),
    committed: Type.Integer({ minimum: 0 }),
    byStatus: StatusCountsSchema,
    byAllocation: AllocationCountsSchema,
  }),
  state: AdminArtworkStateSchema,
  publishBlockers: Type.Array(AdminArtworkPublishBlockerSchema),
  publishedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  archivedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
  version: CatalogueVersionSchema,
});
export type AdminArtworkDetail = Static<typeof AdminArtworkDetailSchema>;

/** 409 body: a stale save carries `currentVersion`; a taken slug or a refused rule does not. */
export const CatalogueConflictBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  currentVersion: Type.Optional(CatalogueVersionSchema),
});

export const AdminArtistStatusSchema = Type.Union([
  Type.Literal("active"),
  Type.Literal("archived"),
]);
export type AdminArtistStatus = Static<typeof AdminArtistStatusSchema>;

/** Artist list sorts; the first is the default. */
export const ADMIN_ARTIST_SORTS = ["created_desc", "created_asc"] as const;
export type AdminArtistSort = (typeof ADMIN_ARTIST_SORTS)[number];

export const AdminArtistListQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String({ maxLength: 512 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  /** Name or slug. */
  q: Type.Optional(Type.String({ maxLength: ARTWORK_LIST_SEARCH_MAX_LENGTH })),
  status: Type.Optional(AdminArtistStatusSchema),
  /** Newest first by default; the artist id breaks ties. */
  sort: Type.Optional(Type.Union(ADMIN_ARTIST_SORTS.map((sort) => Type.Literal(sort)))),
});
export type AdminArtistListQuery = Static<typeof AdminArtistListQuerySchema>;

export const AdminArtistCreateBodySchema = Type.Object(
  {
    displayName: Type.String({ minLength: 1, maxLength: ARTIST_NAME_MAX_LENGTH }),
    slug: SlugSchema,
    discipline: NullableText(ARTIST_DISCIPLINE_MAX_LENGTH),
  },
  { additionalProperties: false },
);
export type AdminArtistCreateBody = Static<typeof AdminArtistCreateBodySchema>;

export const AdminArtistCreateResponseSchema = Type.Object({
  artistId: Type.String({ format: "uuid" }),
  slug: Type.String(),
});

export const AdminArtistArchiveResponseSchema = Type.Object({
  artistId: Type.String({ format: "uuid" }),
  archived: Type.Boolean(),
});
