import { Type } from "@sinclair/typebox";

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
  nextCursor: Type.Optional(Type.String()),
});

export const PublicArtistDetailSchema = Type.Object(
  {
    slug: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    discipline: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    bio: Type.Union([Type.String(), Type.Null()]),
    portraitUrl: Type.Union([Type.String({ minLength: 1, maxLength: 2048 }), Type.Null()]),
    artworkCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export type PublicArtistSummary = typeof PublicArtistSummarySchema.static;
export type PublicArtistList = typeof PublicArtistListSchema.static;
export type PublicArtistDetail = typeof PublicArtistDetailSchema.static;
