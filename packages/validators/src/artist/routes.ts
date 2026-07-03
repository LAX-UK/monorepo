import { z } from "zod";
import { artistKindEnum } from "./shared-fields.js";

/** GET /artists/search — public 3-pass search. */
export const artistSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

/** POST /artists/propose-matches — admin match buckets. */
export const artistProposeMatchesBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(20).optional(),
});

/** POST /artists — staff registry create (route-level subset). */
export const artistRouteCreateBodySchema = z.object({
  displayName: z.string().min(1).max(200),
  kind: artistKindEnum.optional(),
  shortBio: z.string().max(1000).optional(),
  nationality: z.string().max(100).optional(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .optional(),
  birthYear: z.string().max(10).optional(),
  deathYear: z.string().max(10).optional(),
  foundedYear: z.string().max(10).optional(),
  dissolvedYear: z.string().max(10).optional(),
  categoryIds: z.array(z.string().uuid()).max(20).optional(),
});

/** GET /artists/check-name */
export const artistCheckNameQuerySchema = z.object({
  displayName: z.string().min(1).max(200),
});

export function artistMergeConfirmationPhrase(displayName: string): string {
  return `MERGE INTO ${displayName.trim()}`;
}

/** POST /artists/:id/merge — body (fromArtistId comes from URL). */
export const artistMergeBodySchema = z.object({
  intoArtistId: z.string().uuid(),
  fromArtistId: z.string().uuid(),
  reason: z.string().min(10).max(1000),
  confirmationPhrase: z.string().min(1).max(500),
});

/** POST /artists/:id/review */
export const artistReviewBodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reviewNotes: z.string().max(1000).optional(),
  rejectionReason: z.string().max(1000).optional(),
});

/** POST /artists/:id/aliases */
export const artistAddAliasBodySchema = z.object({
  alias: z.string().min(1).max(200),
  kind: z.string().max(50).optional(),
});

/** Route param schemas (`id` segment name matches Hono routes). */
export const artistUuidParamSchema = z.object({ id: z.string().uuid() });
export const artistSlugParamSchema = z.object({ slug: z.string().min(1).max(120) });

/** GET /artists/public — flat approved directory (legacy). */
export const artistPublicListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
  offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
});
