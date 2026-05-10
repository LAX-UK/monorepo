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

export const adminArtistListQuerySchema = z.object({
  includeArchived: z.coerce.boolean().optional().default(false),
  q: z.string().trim().max(200).optional(),
  kind: artistKindEnum.optional(),
  status: artistAdminStatusEnum.optional(),
  /** Filter profiles linked to this platform user (`artist_profile.owner_user_id`). */
  ownerUserId: z.string().trim().min(1).max(191).optional(),
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
