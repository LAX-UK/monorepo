import { auctionStatuses, auctionTypes } from "@auction/types";
import { z } from "zod";

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal string");

export const createAuctionSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  images: z.array(z.string().url()).max(20).optional(),
  categoryId: z.string().uuid().optional(),
  auctionType: z.enum(auctionTypes),
  startingPrice: decimalString,
  reservePrice: decimalString.optional(),
  buyNowPrice: decimalString.optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});

export const listAuctionsQuerySchema = z.object({
  status: z.enum(auctionStatuses).optional(),
  categoryId: z.string().uuid().optional(),
  sellerId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;
