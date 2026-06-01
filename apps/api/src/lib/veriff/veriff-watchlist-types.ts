import { z } from "zod";

const hitSchema = z
  .object({
    datasets: z.array(z.string()).optional().nullable(),
    listType: z.string().optional().nullable(),
    listName: z.string().optional().nullable(),
    matchTypes: z.array(z.string()).optional().nullable(),
    name: z.string().optional().nullable(),
    matchedName: z.string().optional().nullable(),
    score: z.number().optional().nullable(),
  })
  .passthrough();

/**
 * Veriff "watchlist-screening" webhook. Veriff has shipped a few payload shapes
 * over time (top-level vs. nested under `data`), so this schema is deliberately
 * permissive and the normalizer reads defensively from either location.
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
    data: z.record(z.unknown()).optional().nullable(),
    matchStatus: z.string().optional().nullable(),
    monitoringStatus: z.string().optional().nullable(),
    totalHits: z.number().optional().nullable(),
    hits: z.array(hitSchema).optional().nullable(),
  })
  .passthrough();

export type VeriffWatchlistWebhookPayload = z.infer<typeof veriffWatchlistWebhookSchema>;
export type VeriffWatchlistHit = z.infer<typeof hitSchema>;
