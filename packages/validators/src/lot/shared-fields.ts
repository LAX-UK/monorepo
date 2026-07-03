import { lotAuctionTypes } from "@auction/types";
import { z } from "zod";
import { mediaReferenceSchema } from "../media.js";
import { moneyGte, moneyLt } from "../money-compare.js";

export const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal string");

export const buyerPremiumRateString = z
  .string()
  .regex(/^\d(\.\d{1,4})?$/, "Must be a decimal between 0 and 1")
  .refine((s) => {
    const n = Number.parseFloat(s);
    return n >= 0 && n <= 1;
  }, "Buyer premium rate must be between 0 and 1");

export const categoryIdsSchema = z
  .array(z.string().uuid())
  .min(1, "Choose at least one category")
  .max(8, "Choose no more than 8 categories");

export function normalizeCategoryIdsInput(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.categoryIds)) return raw;
  if (typeof record.categoryId === "string" && record.categoryId.length > 0) {
    return { ...record, categoryIds: [record.categoryId] };
  }
  return raw;
}

export const createLotBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  medium: z.string().max(500).optional(),
  dimensions: z.string().max(200).optional(),
  images: z.array(mediaReferenceSchema).max(50).optional(),
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
  autoBidEnabled: z.boolean().optional(),
  autoBidStepMin: decimalString.optional(),
  autoBidStepMax: decimalString.optional(),
  autoBidStepPresets: z.array(z.number().positive().finite()).max(20).nullable().optional(),
  dutchDecrementAmount: decimalString.optional(),
  dutchDecrementIntervalMs: z.coerce.number().int().min(1000).max(86_400_000).optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  saleId: z.string().uuid("Choose a sale"),
  lotNumber: z.coerce.number().int().positive().nullable().optional(),
  artistId: z.string().uuid().nullable().optional(),
});

export type CreateLotBody = z.infer<typeof createLotBodySchema>;

export function refineLotPricingFields(
  values: Partial<CreateLotBody>,
  ctx: z.RefinementCtx,
  opts?: { requireBuyNowWhenTypeSet?: boolean },
) {
  const starting = values.startingPrice?.trim();
  const reserve = values.reservePrice?.trim();
  if (starting && reserve && moneyLt(reserve, starting)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Reserve must be at least the starting price",
      path: ["reservePrice"],
    });
  }

  const buyNow = values.buyNowPrice?.trim();
  if (values.auctionType === "buy_it_now" && opts?.requireBuyNowWhenTypeSet !== false) {
    if (!buyNow) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Buy now price is required",
        path: ["buyNowPrice"],
      });
    }
  }

  if (buyNow && starting && moneyLt(buyNow, starting)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Buy now price must be at least the list / floor price",
      path: ["buyNowPrice"],
    });
  }

  const floor =
    starting && reserve
      ? moneyGte(reserve, starting)
        ? reserve
        : starting
      : (reserve ?? starting);
  if (buyNow && floor && moneyLt(buyNow, floor)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Buy now price must be at least the reserve (or starting price when no reserve)",
      path: ["buyNowPrice"],
    });
  }
}

const createLotBodyWithPricingRefine = createLotBodySchema.superRefine((values, ctx) =>
  refineLotPricingFields(values, ctx, { requireBuyNowWhenTypeSet: true }),
);

export const createLotBodyWithPricingRefineSchema = createLotBodyWithPricingRefine;
