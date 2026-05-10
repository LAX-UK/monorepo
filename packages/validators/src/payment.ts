import { z } from "zod";

export const createPaymentBodySchema = z.object({
  lotId: z.string().uuid(),
});

export const paymentIdParamSchema = z.object({
  id: z.string().uuid(),
});

/** Optional `?status` filter for `GET /payments/me`. Mirrors `PaymentStatus`. */
export const myPaymentsQuerySchema = z.object({
  status: z
    .enum(["pending", "authorized", "captured", "refunded", "requires_manual_review", "cancelled"])
    .optional(),
});

export type MyPaymentsQuery = z.infer<typeof myPaymentsQuerySchema>;
