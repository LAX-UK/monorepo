import { z } from "zod";

export const createPaymentBodySchema = z.object({
  lotId: z.string().uuid(),
  addressId: z.string().uuid("Choose a saved address before continuing."),
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

const paymentStatusFilterSchema = z.enum([
  "pending",
  "authorized",
  "captured",
  "refunded",
  "requires_manual_review",
  "cancelled",
]);

/** Paginated admin payments table (`GET /admin/payments`). */
export const adminPaymentsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: paymentStatusFilterSchema.optional(),
  q: z.string().trim().optional(),
});

export type AdminPaymentsListQuery = z.infer<typeof adminPaymentsListQuerySchema>;
