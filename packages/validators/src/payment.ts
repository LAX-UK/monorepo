import { z } from "zod";

export const createPaymentBodySchema = z.object({
  auctionId: z.string().uuid(),
});
