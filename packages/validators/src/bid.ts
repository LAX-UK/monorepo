import { z } from "zod";

export const placeBidSchema = z.object({
  auctionId: z.string().uuid(),
  amount: z.number().positive().finite(),
});

export type PlaceBidInput = z.infer<typeof placeBidSchema>;
