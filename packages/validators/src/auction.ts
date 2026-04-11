import { auctionStatuses, auctionTypes } from "@auction/types";
import { z } from "zod";

const decimalString = z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal string");

const buyerPremiumRateString = z
  .string()
  .regex(/^\d(\.\d{1,4})?$/, "Must be a decimal between 0 and 1")
  .refine((s) => {
    const n = Number.parseFloat(s);
    return n >= 0 && n <= 1;
  }, "Buyer premium rate must be between 0 and 1");

export const createAuctionSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  medium: z.string().max(500).optional(),
  dimensions: z.string().max(200).optional(),
  images: z.array(z.string().url()).max(20).optional(),
  categoryId: z.string().uuid().optional(),
  auctionType: z.enum(auctionTypes),
  startingPrice: decimalString,
  reservePrice: decimalString.optional(),
  buyNowPrice: decimalString.optional(),
  buyerPremiumRate: buyerPremiumRateString.optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});

const listSort = z
  .enum(["createdDesc", "endingAsc", "hammerDesc", "endedDesc"])
  .optional();

export const listAuctionsQuerySchema = z.object({
  status: z.enum(auctionStatuses).optional(),
  categoryId: z.string().uuid().optional(),
  sellerId: z.string().optional(),
  winnerId: z.string().optional(),
  endYear: z.coerce.number().int().min(1970).max(2100).optional(),
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

export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;
