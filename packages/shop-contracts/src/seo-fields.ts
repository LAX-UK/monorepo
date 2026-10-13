import { Type } from "@sinclair/typebox";

/** Search snippets truncate near 60 characters / 160 characters; the caps leave headroom. */
export const SEO_TITLE_MAX_LENGTH = 120;
export const SEO_DESCRIPTION_MAX_LENGTH = 320;

/** Public detail responses; optional so storefronts parse responses from an older shop-api. */
export const PublicSeoFieldsProperties = {
  seoTitle: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
  seoDescription: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
};

const SeoTitleWrite = Type.Union([
  Type.String({ minLength: 1, maxLength: SEO_TITLE_MAX_LENGTH }),
  Type.Null(),
]);
const SeoDescriptionWrite = Type.Union([
  Type.String({ minLength: 1, maxLength: SEO_DESCRIPTION_MAX_LENGTH }),
  Type.Null(),
]);

/** Admin writes: omitted leaves the stored value unchanged; `null` clears it. */
export const SeoFieldsWriteProperties = {
  seoTitle: Type.Optional(SeoTitleWrite),
  seoDescription: Type.Optional(SeoDescriptionWrite),
};

export const ArtistSeoWriteBodySchema = Type.Object(
  { seoTitle: SeoTitleWrite, seoDescription: SeoDescriptionWrite },
  { additionalProperties: false },
);

export type SeoFields = { seoTitle: string | null; seoDescription: string | null };
export type ArtistSeoWriteBody = typeof ArtistSeoWriteBodySchema.static;
