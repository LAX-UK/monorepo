import { z } from "zod";

const listingSchema = z
  .object({
    sourceName: z.string().optional().nullable(),
    sourceUrl: z.string().optional().nullable(),
    snippet: z.string().optional().nullable(),
    date: z.string().optional().nullable(),
  })
  .passthrough();

const listingsRelatedToMatchSchema = z
  .object({
    warnings: z.array(listingSchema).optional().nullable(),
    sanctions: z.array(listingSchema).optional().nullable(),
    fitnessProbity: z.array(listingSchema).optional().nullable(),
    pep: z.array(listingSchema).optional().nullable(),
    adverseMedia: z.array(listingSchema).optional().nullable(),
  })
  .passthrough();

const hitSchema = z
  .object({
    matchedName: z.string().optional().nullable(),
    countries: z.array(z.string()).optional().nullable(),
    dateOfBirth: z.string().optional().nullable(),
    dateOfDeath: z.string().optional().nullable(),
    matchTypes: z.array(z.string()).optional().nullable(),
    aka: z.array(z.string()).optional().nullable(),
    associates: z.array(z.string()).optional().nullable(),
    listingsRelatedToMatch: listingsRelatedToMatchSchema.optional().nullable(),
    // Legacy shapes (pre-2025 payloads) — kept for forward-compat reads.
    datasets: z.array(z.string()).optional().nullable(),
    listType: z.string().optional().nullable(),
    listName: z.string().optional().nullable(),
    name: z.string().optional().nullable(),
    score: z.number().optional().nullable(),
  })
  .passthrough();

const searchTermSchema = z
  .object({
    name: z.string().optional().nullable(),
    year: z.string().optional().nullable(),
    lists: z.array(z.string()).optional().nullable(),
    countries: z.array(z.string()).optional().nullable(),
    exactMatch: z.union([z.boolean(), z.string()]).optional().nullable(),
    matchThreshold: z.union([z.number(), z.string()]).optional().nullable(),
    excludeDeceased: z.union([z.boolean(), z.string()]).optional().nullable(),
  })
  .passthrough();

const watchlistDataSchema = z
  .object({
    attemptId: z.string().optional().nullable(),
    sessionId: z.string().optional().nullable(),
    vendorData: z.string().optional().nullable(),
    endUserId: z.string().optional().nullable(),
    checkType: z.enum(["initial_result", "updated_result"]).optional().nullable(),
    matchStatus: z.string().optional().nullable(),
    monitorStatus: z.string().optional().nullable(),
    monitoringStatus: z.string().optional().nullable(),
    searchTerm: searchTermSchema.optional().nullable(),
    totalHits: z.union([z.number(), z.string()]).optional().nullable(),
    createdAt: z.string().optional().nullable(),
    hits: z.array(hitSchema).optional().nullable(),
    verification: z
      .object({
        id: z.string().optional().nullable(),
        vendorData: z.string().optional().nullable(),
      })
      .passthrough()
      .optional()
      .nullable(),
  })
  .passthrough();

/**
 * Veriff watchlist-screening webhook / GET response.
 * Canonical shape: `{ status, data: { sessionId, matchStatus, hits, ... } }`.
 * Older integrations may flatten fields at the top level — the normalizer reads both.
 */
export const veriffWatchlistWebhookSchema = z
  .object({
    status: z.string().optional().nullable(),
    attemptId: z.string().optional().nullable(),
    sessionId: z.string().optional().nullable(),
    vendorData: z.string().optional().nullable(),
    verification: z
      .object({
        id: z.string().optional().nullable(),
        vendorData: z.string().optional().nullable(),
      })
      .passthrough()
      .optional()
      .nullable(),
    data: watchlistDataSchema.optional().nullable(),
    checkType: z.enum(["initial_result", "updated_result"]).optional().nullable(),
    matchStatus: z.string().optional().nullable(),
    monitorStatus: z.string().optional().nullable(),
    monitoringStatus: z.string().optional().nullable(),
    totalHits: z.union([z.number(), z.string()]).optional().nullable(),
    hits: z.array(hitSchema).optional().nullable(),
    searchTerm: searchTermSchema.optional().nullable(),
    createdAt: z.string().optional().nullable(),
  })
  .passthrough();

export type VeriffWatchlistWebhookPayload = z.infer<typeof veriffWatchlistWebhookSchema>;
export type VeriffWatchlistHit = z.infer<typeof hitSchema>;
export type VeriffWatchlistListing = z.infer<typeof listingSchema>;
export type VeriffListingsRelatedToMatch = z.infer<typeof listingsRelatedToMatchSchema>;
