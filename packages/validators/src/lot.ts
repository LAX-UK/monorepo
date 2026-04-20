import { lotAuctionTypes, lotStatuses } from "@auction/types";
import { z } from "zod";

const decimalString = z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal string");

const buyerPremiumRateString = z
  .string()
  .regex(/^\d(\.\d{1,4})?$/, "Must be a decimal between 0 and 1")
  .refine((s) => {
    const n = Number.parseFloat(s);
    return n >= 0 && n <= 1;
  }, "Buyer premium rate must be between 0 and 1");

export const createLotSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  medium: z.string().max(500).optional(),
  dimensions: z.string().max(200).optional(),
  images: z.array(z.string().url()).max(20).optional(),
  categoryId: z.string().uuid(),
  auctionType: z.enum(lotAuctionTypes),
  startingPrice: decimalString,
  reservePrice: decimalString.optional(),
  buyNowPrice: decimalString.optional(),
  buyerPremiumRate: buyerPremiumRateString.optional(),
  minBidIncrement: decimalString.optional(),
  dutchDecrementAmount: decimalString.optional(),
  dutchDecrementIntervalMs: z.coerce.number().int().min(1000).max(86_400_000).optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  saleId: z.string().uuid().nullable().optional(),
  lotNumber: z.coerce.number().int().positive().nullable().optional(),
});

const listSort = z.enum(["createdDesc", "endingAsc", "hammerDesc", "endedDesc"]).optional();

export const listLotsQuerySchema = z.object({
  status: z.enum(lotStatuses).optional(),
  categoryId: z.string().uuid().optional(),
  sellerId: z.string().optional(),
  winnerId: z.string().optional(),
  saleId: z.string().uuid().optional(),
  endYear: z.coerce.number().int().min(1970).max(2100).optional(),
  /** Case-insensitive substring on lot title (server-side search). */
  q: z.string().trim().max(200).optional(),
  sort: listSort,
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const archiveSummaryQuerySchema = z.object({
  endYear: z.coerce.number().int().min(1970).max(2100).optional(),
});

/** Same filters as archive grid; status is always `ended` on the server. */
export const archiveCountQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  endYear: z.coerce.number().int().min(1970).max(2100).optional(),
});

export type CreateLotInput = z.infer<typeof createLotSchema>;

/** Partial update for draft lots (admin). */
export const updateLotSchema = createLotSchema.partial();

export const lotIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const cancelLotBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

/** Lot rows nested under `POST /sales` (no `saleId`; set server-side). */
export const createNestedLotForSaleSchema = createLotSchema
  .omit({ saleId: true })
  .extend({ sellerId: z.string().min(1).max(191) });

export type CreateNestedLotForSaleInput = z.infer<typeof createNestedLotForSaleSchema>;
