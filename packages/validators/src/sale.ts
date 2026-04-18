import { saleStatuses } from "@auction/types";
import { z } from "zod";
import { createNestedLotForSaleSchema } from "./lot.js";

const buyerPremiumRateString = z
  .string()
  .regex(/^\d(\.\d{1,4})?$/, "Must be a decimal between 0 and 1")
  .refine((s) => {
    const n = Number.parseFloat(s);
    return n >= 0 && n <= 1;
  }, "Buyer premium rate must be between 0 and 1");

export const createSaleSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  coverImages: z.array(z.string().url()).max(20).optional(),
  categoryId: z.string().uuid().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  previewStartTime: z.coerce.date().optional(),
  buyerPremiumRate: buyerPremiumRateString.optional(),
  terms: z.string().max(50_000).optional(),
  lots: z.array(createNestedLotForSaleSchema).max(500).optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const updateSaleSchema = createSaleSchema.partial().omit({ lots: true });

export const listSalesQuerySchema = z.object({
  status: z.enum(saleStatuses).optional(),
  categoryId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const saleIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const cancelSaleBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export const saleLotIdParamSchema = z.object({
  id: z.string().uuid(),
  lotId: z.string().uuid(),
});
