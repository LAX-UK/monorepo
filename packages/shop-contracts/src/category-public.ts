import { Type } from "@sinclair/typebox";

export const PublicCategorySummarySchema = Type.Object(
  {
    slug: Type.String({ minLength: 1 }),
    label: Type.String({ minLength: 1 }),
    imageUrl: Type.Union([Type.String({ minLength: 1, maxLength: 2048 }), Type.Null()]),
    artworkCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const PublicCategoryListSchema = Type.Object({
  items: Type.Array(PublicCategorySummarySchema),
  nextCursor: Type.Optional(Type.String()),
});

export type PublicCategorySummary = typeof PublicCategorySummarySchema.static;
export type PublicCategoryList = typeof PublicCategoryListSchema.static;
