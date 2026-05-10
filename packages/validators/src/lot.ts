import { lotAuctionTypes, lotStatuses } from "@auction/types";
import { z } from "zod";
import { mediaReferenceSchema } from "./media.js";

const decimalString = z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal string");

const buyerPremiumRateString = z
  .string()
  .regex(/^\d(\.\d{1,4})?$/, "Must be a decimal between 0 and 1")
  .refine((s) => {
    const n = Number.parseFloat(s);
    return n >= 0 && n <= 1;
  }, "Buyer premium rate must be between 0 and 1");

const categoryIdsSchema = z
  .array(z.string().uuid())
  .min(1, "Choose at least one category")
  .max(8, "Choose no more than 8 categories");

function normalizeCategoryIdsInput(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.categoryIds)) return raw;
  if (typeof record.categoryId === "string" && record.categoryId.length > 0) {
    return { ...record, categoryIds: [record.categoryId] };
  }
  return raw;
}

const createLotBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  medium: z.string().max(500).optional(),
  dimensions: z.string().max(200).optional(),
  images: z.array(mediaReferenceSchema).max(20).optional(),
  sellerId: z.string().min(1).max(191).optional(),
  sellerLegalEntityId: z.string().uuid().optional(),
  categoryIds: categoryIdsSchema,
  categoryId: z.string().uuid().optional(),
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
  artistId: z.string().uuid().nullable().optional(),
});

export const createLotSchema = z.preprocess(normalizeCategoryIdsInput, createLotBodySchema);

const listSort = z
  .enum(["createdDesc", "endingAsc", "hammerDesc", "endedDesc", "sellerAsc"])
  .optional();

export const listLotsQuerySchema = z.object({
  status: z.enum(lotStatuses).optional(),
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
  sellerId: z.string().optional(),
  winnerId: z.string().optional(),
  saleId: z.string().uuid().optional(),
  artistId: z.string().uuid().optional(),
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
  endYear: z.coerce.number().int().min(1970).max(2100).optional(),
});

export type CreateLotInput = z.infer<typeof createLotSchema>;

/** Partial update for draft lots (admin). */
export const updateLotSchema = z.preprocess(
  normalizeCategoryIdsInput,
  createLotBodySchema.partial(),
);

export const lotIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const cancelLotBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export const bulkLotsBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  op: z.enum(["publish", "cancel"]),
  reason: z.string().max(500).optional(),
});

/** Lot rows nested under `POST /sales` (no `saleId`; set server-side). */
export const createNestedLotForSaleSchema = z.preprocess(
  normalizeCategoryIdsInput,
  createLotBodySchema.omit({ saleId: true }).extend({ sellerId: z.string().min(1).max(191) }),
);

export type CreateNestedLotForSaleInput = z.infer<typeof createNestedLotForSaleSchema>;

/** Marketing / catalog copy (subset of `LotMarketingDetails`). */
export const conditionReportSchema = z.object({
  summary: z.string().max(5000).optional(),
  details: z.string().max(10_000).optional(),
  downloadUrl: z.string().url().max(2048).optional(),
});

export const provenanceEntrySchema = z.object({
  period: z.string().max(120).optional(),
  note: z.string().min(1).max(500),
});

export const exhibitionEntrySchema = z.object({
  year: z.string().max(20).optional(),
  venue: z.string().min(1).max(200),
  note: z.string().max(500).optional(),
});

/** Catalog-copy patch on a lot. Artist attribution is `lot.artist_id` only;
 * marketing PATCH does not accept artist fields. */
export const updateLotMarketingDetailsSchema = z.object({
  conditionReport: conditionReportSchema.nullable().optional(),
  provenance: z.array(provenanceEntrySchema).max(50).nullable().optional(),
  exhibitions: z.array(exhibitionEntrySchema).max(50).nullable().optional(),
  imageAlts: z.array(z.string().max(500)).max(20).nullable().optional(),
  artistNote: z.string().max(5000).nullable().optional(),
});

export type UpdateLotMarketingDetailsInput = z.infer<typeof updateLotMarketingDetailsSchema>;
