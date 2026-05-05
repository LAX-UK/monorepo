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

export const artistIdParamSchema = z.object({
  artistId: z.string().uuid(),
});

export const adminArtistListQuerySchema = z.object({
  includeArchived: z.coerce.boolean().optional().default(false),
  q: z.string().trim().max(200).optional(),
});

export const adminCreateArtistBodySchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(200),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens")
    .optional(),
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
