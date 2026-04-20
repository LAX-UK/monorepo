import { saleDeliveryModes, saleStatuses } from "@auction/types";
import { z } from "zod";
import { createNestedLotForSaleSchema } from "./lot.js";
import { isAllowedStreamUrl } from "./stream-embed.js";

const buyerPremiumRateString = z
  .string()
  .regex(/^\d(\.\d{1,4})?$/, "Must be a decimal between 0 and 1")
  .refine((s) => {
    const n = Number.parseFloat(s);
    return n >= 0 && n <= 1;
  }, "Buyer premium rate must be between 0 and 1");

const streamUrlField = z
  .union([z.string().url().max(500), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined ? null : v))
  .refine((v) => v == null || isAllowedStreamUrl(v), {
    message: "Unsupported stream URL host",
  });

const saleCreateBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  coverImages: z.array(z.string().url()).max(20).optional(),
  categoryId: z.string().uuid().optional(),
  deliveryMode: z.enum(saleDeliveryModes).optional(),
  streamUrl: streamUrlField,
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  previewStartTime: z.coerce.date().optional(),
  buyerPremiumRate: buyerPremiumRateString.optional(),
  terms: z.string().max(50_000).optional(),
  lots: z.array(createNestedLotForSaleSchema).max(500).optional(),
});

export const createSaleSchema = saleCreateBodySchema.superRefine((data, ctx) => {
  if (data.deliveryMode === "onsite" && data.streamUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Stream URL must be empty for onsite-only salerooms",
      path: ["streamUrl"],
    });
  }
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const updateSaleSchema = saleCreateBodySchema
  .partial()
  .omit({ lots: true })
  .superRefine((data, ctx) => {
    if (data.deliveryMode === "onsite" && data.streamUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Stream URL must be empty for onsite-only salerooms",
        path: ["streamUrl"],
      });
    }
  });

export const listSalesQuerySchema = z.object({
  status: z.enum(saleStatuses).optional(),
  statuses: z
    .string()
    .optional()
    .transform((s) => {
      if (!s?.trim()) return undefined;
      return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean) as (typeof saleStatuses)[number][];
    })
    .refine((arr) => arr == null || arr.every((x) => saleStatuses.includes(x)), {
      message: "Invalid sale status in statuses",
    }),
  categoryId: z.string().uuid().optional(),
  sort: z.enum(["createdDesc", "startAsc"]).optional().default("createdDesc"),
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
