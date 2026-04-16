import { z } from "zod";

export const createPaymentBodySchema = z.object({
  auctionId: z.string().uuid(),
});

export const paymentIdParamSchema = z.object({
  id: z.string().uuid(),
});
