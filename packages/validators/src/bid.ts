import { z } from "zod";

function hasAtMostTwoDecimalPlaces(n: number): boolean {
  return Number.isFinite(n) && Math.round(n * 100) / 100 === n;
}

const moneyAmount = z.number().positive().finite().refine(hasAtMostTwoDecimalPlaces, {
  message: "Amount must have at most 2 decimal places",
});

export const placeBidSchema = z
  .object({
    lotId: z.string().uuid(),
    amount: moneyAmount,
    maxAutoBidAmount: moneyAmount.optional(),
    autoBidStepAmount: moneyAmount.optional(),
    /** Client-generated id for Meta / GA4 deduplication (optional). */
    marketingEventId: z.string().max(128).optional(),
  })
  .refine((d) => d.maxAutoBidAmount === undefined || d.maxAutoBidAmount >= d.amount, {
    message: "maxAutoBidAmount must be >= amount",
    path: ["maxAutoBidAmount"],
  });

export type PlaceBidInput = z.infer<typeof placeBidSchema>;
