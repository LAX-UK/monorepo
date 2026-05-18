import { z } from "zod";

const marketingEventNameSchema = z.enum([
  "BidPlaced",
  "Purchase",
  "InitiateCheckout",
  "CompleteRegistration",
  "Lead",
  "AddToWishlist",
  "RemoveFromWishlist",
]);

export const adminMarketingEventsReplayBodySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  names: z.array(marketingEventNameSchema).optional(),
  includeFailed: z.boolean().optional(),
  /** Max rows to requeue in one call (default 500). */
  limit: z.number().int().min(1).max(5000).optional(),
  /** When true, returns how many rows would be requeued without updating. */
  dryRun: z.boolean().optional(),
});

export const adminMarketingEventsStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
});
