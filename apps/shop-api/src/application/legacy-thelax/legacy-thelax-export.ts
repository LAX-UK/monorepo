import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

/**
 * Normalized www.thelax.art content (`scripts/seo/crawl-legacy-thelax.mjs` writes it from a
 * crawl; a CMS database export can emit the same shape). Block media keys and link hrefs
 * still hold absolute legacy URLs; the importer rewrites them.
 */
export const LEGACY_THELAX_EXPORT_SCHEMA_VERSION = 1;

const Nullable = <T extends ReturnType<typeof Type.String>>(schema: T) =>
  Type.Union([schema, Type.Null()]);
const Text = Type.String();
const LegacyPath = Type.String({ minLength: 1, pattern: "^/" });
const Slug = Type.String({ minLength: 1, maxLength: 200 });
const ImageRef = Type.Object({ url: Type.String({ minLength: 1 }), alt: Nullable(Text) });
const TaxonomyRef = Type.Object({ name: Text, legacyPath: LegacyPath });
const Blocks = Type.Array(Type.Unknown());
const Seo = {
  seoTitle: Nullable(Text),
  seoDescription: Nullable(Text),
};

const LegacyArtistSchema = Type.Object({
  legacyPath: LegacyPath,
  slug: Slug,
  name: Type.String({ minLength: 1 }),
  bio: Nullable(Text),
  portraitUrl: Nullable(Text),
  ...Seo,
});

const LegacyArtworkSchema = Type.Object({
  legacyPath: LegacyPath,
  kind: Type.Union([Type.Literal("original"), Type.Literal("print"), Type.Literal("sculpture")]),
  slug: Slug,
  title: Type.String({ minLength: 1 }),
  artistName: Nullable(Text),
  artistLegacyPath: Type.Union([LegacyPath, Type.Null()]),
  sold: Type.Boolean(),
  unique: Type.Boolean(),
  certificate: Type.Boolean(),
  year: Type.Union([Type.Integer(), Type.Null()]),
  dimensionsText: Nullable(Text),
  dimensions: Type.Union([
    Type.Object({
      heightCm: Type.Union([Type.Number(), Type.Null()]),
      widthCm: Type.Union([Type.Number(), Type.Null()]),
      depthCm: Type.Union([Type.Number(), Type.Null()]),
    }),
    Type.Null(),
  ]),
  description: Nullable(Text),
  styles: Type.Array(TaxonomyRef),
  techniques: Type.Array(TaxonomyRef),
  periods: Type.Array(TaxonomyRef),
  images: Type.Array(ImageRef),
  ...Seo,
});

const LegacySeriesSchema = Type.Object({
  legacyPath: LegacyPath,
  slug: Slug,
  name: Nullable(Text),
  artistLegacyPath: Type.Union([LegacyPath, Type.Null()]),
});

const LegacyTaxonomySchema = Type.Object({
  legacyPath: LegacyPath,
  taxonomy: Type.Union([Type.Literal("style"), Type.Literal("technique"), Type.Literal("period")]),
  slug: Slug,
  name: Type.String({ minLength: 1 }),
  intro: Nullable(Text),
  ...Seo,
});

const LegacyStorySchema = Type.Object({
  legacyPath: LegacyPath,
  slug: Slug,
  title: Type.String({ minLength: 1 }),
  cover: Type.Union([ImageRef, Type.Null()]),
  body: Blocks,
  ...Seo,
});

const LegacyPageSchema = Type.Object({
  legacyPath: LegacyPath,
  slug: Slug,
  title: Type.String({ minLength: 1 }),
  body: Blocks,
  ...Seo,
});

export const LegacyThelaxExportSchema = Type.Object({
  schemaVersion: Type.Literal(LEGACY_THELAX_EXPORT_SCHEMA_VERSION),
  origin: Type.String({ pattern: "^https://" }),
  generatedAt: Text,
  artists: Type.Array(LegacyArtistSchema),
  artworks: Type.Array(LegacyArtworkSchema),
  series: Type.Array(LegacySeriesSchema),
  taxonomies: Type.Array(LegacyTaxonomySchema),
  stories: Type.Array(LegacyStorySchema),
  pages: Type.Array(LegacyPageSchema),
});

export type LegacyThelaxExport = Static<typeof LegacyThelaxExportSchema>;
export type LegacyArtist = Static<typeof LegacyArtistSchema>;
export type LegacyArtwork = Static<typeof LegacyArtworkSchema>;
export type LegacyTaxonomy = Static<typeof LegacyTaxonomySchema>;
export type LegacyStory = Static<typeof LegacyStorySchema>;
export type LegacyPage = Static<typeof LegacyPageSchema>;
export type LegacyImageRef = Static<typeof ImageRef>;

const MAX_REPORTED_ERRORS = 5;

export function parseLegacyThelaxExport(value: unknown): LegacyThelaxExport {
  if (Value.Check(LegacyThelaxExportSchema, value)) return value;
  const errors = [...Value.Errors(LegacyThelaxExportSchema, value)]
    .slice(0, MAX_REPORTED_ERRORS)
    .map((error) => `${error.path || "/"}: ${error.message}`);
  throw new Error(`Invalid legacy thelax export:\n${errors.join("\n")}`);
}
