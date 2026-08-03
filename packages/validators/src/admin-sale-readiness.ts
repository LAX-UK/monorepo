import { z } from "zod";

export const adminSaleReadinessBlockerSchema = z.object({
  id: z.string(),
  label: z.string(),
  count: z.number().int().nonnegative().optional(),
  href: z.string(),
});

export const adminSaleReadinessRowSchema = z.object({
  saleId: z.string(),
  title: z.string(),
  status: z.string(),
  deliveryMode: z.string(),
  startTime: z.string().nullable(),
  daysToStart: z.number().int().nullable(),
  lotsTotal: z.number().int().nonnegative(),
  lotsPublished: z.number().int().nonnegative(),
  lotsDraft: z.number().int().nonnegative(),
  lotsMissingPhotos: z.number().int().nonnegative(),
  lotsMissingEstimates: z.number().int().nonnegative(),
  pendingRegistrations: z.number().int().nonnegative(),
  pendingTelephoneBookings: z.number().int().nonnegative(),
  sessionStatus: z.string().nullable(),
  blockers: z.array(adminSaleReadinessBlockerSchema),
  href: z.string(),
  consoleHref: z.string().nullable(),
});

export const adminSaleReadinessQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(6),
});

export const adminSaleReadinessResponseSchema = z.object({
  items: z.array(adminSaleReadinessRowSchema),
});

export type AdminSaleReadinessRowDto = z.infer<typeof adminSaleReadinessRowSchema>;
export type AdminSaleReadinessQuery = z.infer<typeof adminSaleReadinessQuerySchema>;
