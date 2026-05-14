import { z } from "zod";

const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
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

export const artistKindEnum = z.enum(["artist", "maker", "brand", "marque"]);

export const artistAdminStatusEnum = z.enum(["pending", "approved", "rejected"]);

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
  /** Filter profiles linked to this platform user (`artist_profile.owner_user_id`). */
  ownerUserId: z.string().trim().min(1).max(191).optional(),
  featured: z.coerce.boolean().optional(),
  verified: z.coerce.boolean().optional(),
  linked: adminArtistListLinkedEnum.optional().default("any"),
  sort: adminArtistListSortEnum.optional().default("name_asc"),
  limit: z.coerce.number().int().min(10).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(50_000).optional().default(0),
});

export const adminCreateArtistBodySchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(200),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens")
    .optional(),
  /** Catalogue taxonomy. Admin-created profiles default to `artist`; the API
   * coerces a missing kind into `"artist"` server-side so we keep the schema
   * input/output shapes aligned for the admin form. */
  kind: artistKindEnum.optional(),
  /** Lifecycle. Admin-created profiles are `approved` by default — the API
   * applies the default when missing rather than `.default()` here so the
   * Zod input and output types match. */
  status: artistAdminStatusEnum.optional(),
  portraitUrl: optionalUrl,
  heroImageUrl: optionalUrl,
  shortBio: optionalText(500),
  longBio: optionalText(10_000),
  statement: optionalText(10_000),
  nationality: optionalText(120),
  location: optionalText(160),
  birthYear: optionalText(20),
  deathYear: optionalText(20),
  websiteUrl: optionalUrl,
  featured: z.boolean().optional(),
  verified: z.boolean().optional(),
  archived: z.boolean().optional(),
  ownerUserId: z.string().max(191).nullable().optional(),
});

export const adminUpdateArtistBodySchema = adminCreateArtistBodySchema.partial();

/** Inline create payload used by the admin Artist Picker on lot/submission
 * flows. Trimmed-down vs. {@link adminCreateArtistBodySchema}: the admin only
 * needs to commit a name + kind to attach the artist to a lot. */
export const inlineCreateArtistSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  kind: artistKindEnum.optional().default("artist"),
  shortBio: z.string().trim().max(500).optional(),
  ownerUserId: z.string().max(191).nullable().optional(),
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
  sort: z.enum(["name_asc", "popular", "recent"]).optional().default("name_asc"),
});
