import {
  type ArtistKind,
  CREATOR_KIND_CONFIG,
  type CreatorAttributeField,
  artistKinds,
} from "@auction/types";
import { z } from "zod";
import { mediaReferenceSchema } from "./media.js";

const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

/** ISO 3166-1 alpha-2 country code, normalised to upper case. Accepts "" -> undefined. */
const optionalCountryCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "Use a 2-letter ISO country code, e.g. GB")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value.toUpperCase() : undefined));

const optionalMediaReference = z
  .union([mediaReferenceSchema, z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalUrl = z
  .string()
  .trim()
  .url()
  .max(2048)
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : undefined));

export const artistKindEnum = z.enum(artistKinds);

export const artistAdminStatusEnum = z.enum(["pending", "approved", "rejected", "merged_into"]);

/** Builds a zod schema for one declarative attribute field. */
function attributeFieldSchema(field: CreatorAttributeField): z.ZodTypeAny {
  switch (field.type) {
    case "url":
      return z
        .string()
        .trim()
        .url()
        .max(field.maxLength ?? 2048);
    case "year":
      return z
        .string()
        .trim()
        .max(field.maxLength ?? 20);
    default:
      return z
        .string()
        .trim()
        .max(field.maxLength ?? 200);
  }
}

/** Per-kind attributes object schema generated from {@link CREATOR_KIND_CONFIG}.
 * Unknown keys are stripped; every declared key is optional. This is the
 * discriminator-driven validation that makes attributes "depend on the kind". */
export function creatorAttributesSchemaForKind(kind: ArtistKind): z.ZodObject<z.ZodRawShape> {
  const config = CREATOR_KIND_CONFIG[kind] ?? CREATOR_KIND_CONFIG.artist;
  const shape: z.ZodRawShape = {};
  for (const field of config.attributes) {
    shape[field.key] = attributeFieldSchema(field).optional();
  }
  return z.object(shape);
}

/** Parse + normalise raw attributes against a kind, returning only the declared
 * keys that have a non-empty value. Used by services as the authoritative
 * cleaner before persisting to the JSONB column. */
export function parseCreatorAttributes(
  kind: ArtistKind,
  raw: Record<string, unknown> | undefined | null,
): Record<string, string> {
  if (!raw) return {};
  const parsed = creatorAttributesSchemaForKind(kind).safeParse(raw);
  if (!parsed.success) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (typeof value === "string" && value.trim().length > 0) {
      out[key] = value.trim();
    }
  }
  return out;
}

/** Loose attributes input accepted at the HTTP boundary (per-kind validation is
 * applied via superRefine on the create/update bodies). */
const attributesInputSchema = z.record(z.string().max(2000)).optional();

/** UUID list of categories (departments) a creator belongs to. */
const categoryIdsSchema = z.array(z.string().uuid()).max(20).optional();

export const artistIdParamSchema = z.object({
  artistId: z.string().uuid(),
});

export const adminArtistListSortEnum = z.enum([
  "name_asc",
  "name_desc",
  "updated_desc",
  "updated_asc",
  "lots_desc",
  "lots_asc",
  "status_asc",
  "status_desc",
]);

export const adminArtistListLinkedEnum = z.enum(["any", "yes", "no"]);

export const adminArtistListStatusEnum = z.enum(["pending", "approved", "rejected", "merged_into"]);

export const adminArtistListQuerySchema = z.object({
  includeArchived: z.coerce.boolean().optional().default(false),
  /** When true, only archived profiles (mutually exclusive with default non-archived filter). */
  archivedOnly: z.coerce.boolean().optional().default(false),
  q: z.string().trim().max(200).optional(),
  kind: artistKindEnum.optional(),
  /** Comma-separated kinds, e.g. `brand,marque`. Parsed server-side; takes precedence over `kind` when both sent. */
  kinds: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((raw) => {
      if (!raw) return undefined;
      const tokens = raw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const out: z.infer<typeof artistKindEnum>[] = [];
      for (const t of tokens) {
        const p = artistKindEnum.safeParse(t);
        if (p.success) out.push(p.data);
      }
      return out.length ? out : undefined;
    }),
  status: adminArtistListStatusEnum.optional(),
  /** Filter by collecting category (department) id. */
  categoryId: z.string().uuid().optional(),
  /** Filter by ISO 3166-1 alpha-2 origin country code. */
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
  /** Filter profiles linked to this platform user (`artist_profile.owner_user_id`). */
  ownerUserId: z.string().trim().min(1).max(191).optional(),
  featured: z.coerce.boolean().optional(),
  verified: z.coerce.boolean().optional(),
  linked: adminArtistListLinkedEnum.optional().default("any"),
  sort: adminArtistListSortEnum.optional().default("name_asc"),
  limit: z.coerce.number().int().min(10).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(50_000).optional().default(0),
});

/** Base object (no refinements) so we can derive both create and partial-update
 * schemas. Keep refinements out of here - `.partial()` only exists on ZodObject. */
export const adminArtistBodyObject = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(200),
  /** Catalogue taxonomy. Admin-created profiles default to `artist`; the API
   * coerces a missing kind into `"artist"` server-side so we keep the schema
   * input/output shapes aligned for the admin form. */
  kind: artistKindEnum.optional(),
  /** Lifecycle. Admin-created profiles are `approved` by default — the API
   * applies the default when missing rather than `.default()` here so the
   * Zod input and output types match. */
  status: artistAdminStatusEnum.optional(),
  portraitUrl: optionalMediaReference,
  heroImageUrl: optionalMediaReference,
  shortBio: optionalText(500),
  longBio: optionalText(10_000),
  statement: optionalText(10_000),
  nationality: optionalText(120),
  location: optionalText(160),
  countryCode: optionalCountryCode,
  birthYear: optionalText(20),
  deathYear: optionalText(20),
  foundedYear: optionalText(20),
  dissolvedYear: optionalText(20),
  websiteUrl: optionalUrl,
  featured: z.boolean().optional(),
  verified: z.boolean().optional(),
  archived: z.boolean().optional(),
  ownerUserId: z.string().max(191).nullable().optional(),
  /** Collecting categories (departments). */
  categoryIds: categoryIdsSchema,
  /** Kind-specific rich data; validated against the kind below. */
  attributes: attributesInputSchema,
});

/** Validates `attributes` against the selected (or implicit `artist`) kind. */
function refineCreatorAttributes(
  data: { kind?: ArtistKind | undefined; attributes?: Record<string, string> | undefined },
  ctx: z.RefinementCtx,
): void {
  if (!data.attributes) return;
  const result = creatorAttributesSchemaForKind(data.kind ?? "artist").safeParse(data.attributes);
  if (result.success) return;
  for (const issue of result.error.issues) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: issue.message,
      path: ["attributes", ...issue.path],
    });
  }
}

export const adminCreateArtistBodySchema =
  adminArtistBodyObject.superRefine(refineCreatorAttributes);

export const adminUpdateArtistBodySchema = adminArtistBodyObject
  .partial()
  .superRefine(refineCreatorAttributes);

export function artistDeleteConfirmationPhrase(displayName: string): string {
  return `DELETE ${displayName.trim()}`;
}

export const artistDeleteBodySchema = z.object({
  confirmationPhrase: z.string().min(1).max(500),
});

/** Inline create payload used by the admin Artist Picker on lot/submission
 * flows. Trimmed-down vs. {@link adminCreateArtistBodySchema}: the admin only
 * needs to commit a name + kind to attach the artist to a lot. */
export const inlineCreateArtistSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  kind: artistKindEnum.optional().default("artist"),
  shortBio: z.string().trim().max(500).optional(),
  ownerUserId: z.string().max(191).nullable().optional(),
  categoryIds: categoryIdsSchema,
});

/** Public paginated directory (`GET /artists/browse`). */
export const publicArtistBrowseQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(48).optional().default(24),
  offset: z.coerce.number().int().min(0).max(100_000).optional().default(0),
  q: z.string().trim().max(200).optional(),
  kind: artistKindEnum.optional(),
  /** Comma-separated kinds; takes precedence over `kind` when both are sent. */
  kinds: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((raw) => {
      if (!raw) return undefined;
      const tokens = raw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const out: z.infer<typeof artistKindEnum>[] = [];
      for (const t of tokens) {
        const p = artistKindEnum.safeParse(t);
        if (p.success) out.push(p.data);
      }
      return out.length ? out : undefined;
    }),
  letter: z.string().trim().max(8).optional(),
  living: z.coerce.boolean().optional(),
  historical: z.coerce.boolean().optional(),
  nationality: z.string().trim().max(120).optional(),
  /** Filter by collecting category (department) slug, e.g. `motor-cars`. */
  categorySlug: z.string().trim().max(120).optional(),
  /** Filter by ISO 3166-1 alpha-2 origin country code. */
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
  featuredOnly: z.coerce.boolean().optional(),
  featuredFirst: z.coerce.boolean().optional(),
  /** Decade slug like `1900s`, `1980s`, or `pre-1800`. Filters by `birth_year`. */
  decade: z
    .string()
    .trim()
    .regex(/^(pre-1800|\d{4}s)$/i, "Decade must be like `1900s` or `pre-1800`.")
    .max(16)
    .optional(),
  /** When true, only artists with at least one `active` or `scheduled` lot. */
  hasUpcoming: z.coerce.boolean().optional(),
  sort: z
    .union([z.enum(["name_asc", "popular", "recent"]), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.enum(["name_asc", "popular", "recent"]).optional().default("name_asc")),
});
