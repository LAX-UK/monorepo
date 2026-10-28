import { Type } from "@sinclair/typebox";
import { PublicSeoFieldsProperties } from "./seo-fields.js";

export const PublicArtistSummarySchema = Type.Object(
  {
    slug: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    discipline: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    portraitUrl: Type.Union([Type.String({ minLength: 1, maxLength: 2048 }), Type.Null()]),
    artworkCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const PublicArtistListSchema = Type.Object({
  items: Type.Array(PublicArtistSummarySchema),
  /** Artists matching the filters across all pages; absent for curated placements. */
  total: Type.Optional(Type.Integer({ minimum: 0 })),
  nextCursor: Type.Optional(Type.String()),
});

/**
 * `newest` orders by when the artist was added; `latestEdition` by the artist's most recently
 * listed work in the requested channel, newest first. `latestEdition` returns one page and no
 * cursor.
 */
export const PublicArtistSortSchema = Type.Union([
  Type.Literal("newest"),
  Type.Literal("nameAsc"),
  Type.Literal("nameDesc"),
  Type.Literal("latestEdition"),
]);

export const PublicArtistDetailSchema = Type.Object(
  {
    slug: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    discipline: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    bio: Type.Union([Type.String(), Type.Null()]),
    // 0215 fields stay optional so storefronts parse responses from an older shop-api.
    shortBio: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    portraitUrl: Type.Union([Type.String({ minLength: 1, maxLength: 2048 }), Type.Null()]),
    heroUrl: Type.Optional(
      Type.Union([Type.String({ minLength: 1, maxLength: 2048 }), Type.Null()]),
    ),
    nationality: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    birthYear: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
    deathYear: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
    artworkCount: Type.Integer({ minimum: 0 }),
    ...PublicSeoFieldsProperties,
  },
  { additionalProperties: false },
);

export type PublicArtistSort = typeof PublicArtistSortSchema.static;
export type PublicArtistSummary = typeof PublicArtistSummarySchema.static;
export type PublicArtistList = typeof PublicArtistListSchema.static;
export type PublicArtistDetail = typeof PublicArtistDetailSchema.static;
