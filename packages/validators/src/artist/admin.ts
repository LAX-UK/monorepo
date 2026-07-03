import { z } from "zod";
import {
  artistAdminStatusEnum,
  artistKindEnum,
  attributesInputSchema,
  categoryIdsSchema,
  optionalCountryCode,
  optionalMediaReference,
  optionalText,
  optionalUrl,
  refineCreatorAttributes,
} from "./shared-fields.js";

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
