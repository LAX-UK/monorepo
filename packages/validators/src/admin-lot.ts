import { z } from "zod";

export const adminLotBrowseQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  sellerLegalEntityId: z.string().uuid().optional(),
  categoryIds: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    )
    .pipe(z.array(z.string().uuid()).max(8).optional()),
  artistId: z.string().uuid().optional(),
  state: z.enum(["available", "returned", "all"]).optional().default("available"),
  excludeSaleId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(25).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const attachLotToSaleBodySchema = z.object({
  via: z.enum(["attach_endpoint", "wizard"]).optional().default("attach_endpoint"),
});

export const returnLotToInventoryBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
  confirmVoided: z.boolean().optional(),
  notifyBidders: z.boolean().optional(),
});

export const lotIdOnlyParamSchema = z.object({
  lotId: z.string().uuid(),
});
