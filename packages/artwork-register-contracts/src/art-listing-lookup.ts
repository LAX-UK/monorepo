import { z } from "zod";

/**
 * LAX Shop: what lax.art holds for a set of originals, by the Zoho Product id each listing carries.
 * The worker asks when it tells Zoho where an artwork is, so the place and the link come from the
 * listing itself. Served under `INVENTORY_INTERNAL_PREFIX` with the inventory machine credential.
 */
export const ART_LISTING_LOOKUP_SUBROUTE = "/art-listings/lookup";

/** Zoho reads 50 ids per query, so the worker never needs more than this at once. */
export const ART_LISTING_LOOKUP_MAX_IDS = 100;

export const artListingLookupRequestSchema = z.object({
  zohoProductIds: z.array(z.string().min(1).max(64)).min(1).max(ART_LISTING_LOOKUP_MAX_IDS),
});
export type ArtListingLookupRequest = z.infer<typeof artListingLookupRequestSchema>;

export const artListingFactsSchema = z.object({
  zohoProductId: z.string(),
  artworkId: z.string().uuid(),
  slug: z.string(),
  /** Published and not archived: buyers can see it. */
  published: z.boolean(),
  /** When it went on lax.art; null while it is a draft. */
  publishedAt: z.string().nullable(),
  archived: z.boolean(),
});
export type ArtListingFacts = z.infer<typeof artListingFactsSchema>;

/** One entry per id that has a lax.art listing; ids without one are left out. */
export const artListingLookupAnswerSchema = z.object({
  listings: z.array(artListingFactsSchema),
});
export type ArtListingLookupAnswer = z.infer<typeof artListingLookupAnswerSchema>;
