import { z } from "zod";

export const watchlistBodySchema = z.object({
  auctionId: z.string().uuid(),
});
