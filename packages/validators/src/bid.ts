import { z } from "zod";

export const placeBidSchema = z
  .object({
    lotId: z.string().uuid(),
    amount: z.number().positive().finite(),
    maxAutoBidAmount: z.number().positive().finite().optional(),
  })
  .refine((d) => d.maxAutoBidAmount === undefined || d.maxAutoBidAmount >= d.amount, {
    message: "maxAutoBidAmount must be >= amount",
    path: ["maxAutoBidAmount"],
  });

export type PlaceBidInput = z.infer<typeof placeBidSchema>;
