import { saleDeliveryModes, saleStatuses } from "@auction/types";
import { z } from "zod";
import { saleSettlementStatuses } from "../sale-settlement.js";

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
  /** Case-insensitive title search (admin / staff catalogue views). */
  q: z.string().trim().max(200).optional(),
  deliveryMode: z.enum(saleDeliveryModes).optional(),
  /** Ended sales only — settled when all sold lots have captured/refunded payments. */
  settlementStatus: z.enum(saleSettlementStatuses).optional(),
  categoryId: z.string().uuid().optional(),
  categoryIds: z
    .string()
    .optional()
    .transform((s) => {
      if (!s?.trim()) return undefined;
      return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    })
    .refine((arr) => arr == null || arr.every((x) => z.string().uuid().safeParse(x).success), {
      message: "Invalid category ID in categoryIds",
    }),
  sort: z.enum(["createdDesc", "startAsc"]).optional().default("createdDesc"),
  /** Draft sales missing lots, schedule, or onsite venue (admin setup lens). */
  needsSetup: z.enum(["1"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const saleIdParamSchema = z.object({
  id: z.string().uuid(),
});

/** Saleroom paginated lots — matches API `ListLotsSort` mapping. */
export const listSaleLotsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(48).optional().default(40),
  offset: z.coerce.number().int().min(0).optional().default(0),
  sort: z.enum(["lot", "priceAsc", "priceDesc", "endingAsc"]).optional().default("lot"),
});

export type ListSaleLotsQuery = z.infer<typeof listSaleLotsQuerySchema>;

export const listSaleBiddersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ListSaleBiddersQuery = z.infer<typeof listSaleBiddersQuerySchema>;

export const saleLotIdParamSchema = z.object({
  id: z.string().uuid(),
  lotId: z.string().uuid(),
});
