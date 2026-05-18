import { z } from "zod";

export const placeBidSchema = z
  .object({
    lotId: z.string().uuid(),
    amount: z.number().positive().finite(),
    maxAutoBidAmount: z.number().positive().finite().optional(),
    /** Client-generated id for Meta / GA4 deduplication (optional). */
    marketingEventId: z.string().max(128).optional(),
  })
  .refine((d) => d.maxAutoBidAmount === undefined || d.maxAutoBidAmount >= d.amount, {
    message: "maxAutoBidAmount must be >= amount",
    path: ["maxAutoBidAmount"],
  });

export type PlaceBidInput = z.infer<typeof placeBidSchema>;
