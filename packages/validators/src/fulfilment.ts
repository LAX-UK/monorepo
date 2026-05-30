import { z } from "zod";

export const lotFulfilmentReleaseBodySchema = z.object({
  notes: z.string().max(2000).optional(),
});

export type LotFulfilmentReleaseBody = z.infer<typeof lotFulfilmentReleaseBodySchema>;

export const lotFulfilmentShipBodySchema = z.object({
  carrier: z.string().min(1).max(200),
  trackingNumber: z.string().min(1).max(200),
});

export type LotFulfilmentShipBody = z.infer<typeof lotFulfilmentShipBodySchema>;

export const lotFulfilmentCollectBodySchema = z.object({
  collectedBy: z.string().min(1).max(200),
});

export type LotFulfilmentCollectBody = z.infer<typeof lotFulfilmentCollectBodySchema>;

/** Matches `lot_fulfilment_status` in the database (admin queue filter). */
export const lotFulfilmentStatusSchema = z.enum([
  "awaiting_payment",
  "awaiting_release",
  "released",
  "ready_for_collection",
  "in_transit",
  "delivered",
  "cancelled",
]);

export type LotFulfilmentStatus = z.infer<typeof lotFulfilmentStatusSchema>;

export const adminLotFulfilmentListQuerySchema = z.object({
  status: lotFulfilmentStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type AdminLotFulfilmentListQuery = z.infer<typeof adminLotFulfilmentListQuerySchema>;

export const adminLotFulfilmentLotIdParamSchema = z.object({
  lotId: z.string().uuid(),
});

export type AdminLotFulfilmentLotIdParams = z.infer<typeof adminLotFulfilmentLotIdParamSchema>;
