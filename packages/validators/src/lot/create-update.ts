import { z } from "zod";
import {
  type CreateLotBody,
  createLotBodySchema,
  createLotBodyWithPricingRefineSchema,
  normalizeCategoryIdsInput,
  refineFramedSize,
  refineLotPricingFields,
} from "./shared-fields.js";

export const createLotSchema = z.preprocess(
  normalizeCategoryIdsInput,
  createLotBodyWithPricingRefineSchema,
);

export type CreateLotInput = z.infer<typeof createLotSchema>;

/** Partial update for draft lots (admin). */
export const updateLotSchema = z
  .preprocess(normalizeCategoryIdsInput, createLotBodySchema.partial())
  .superRefine((values, ctx) => {
    if (values.saleId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose a sale",
        path: ["saleId"],
      });
    }
    refineLotPricingFields(values as Partial<CreateLotBody>, ctx, {
      requireBuyNowWhenTypeSet: values.auctionType === "buy_it_now",
    });
    // On an update a missing size is "leave as is", so only an explicit half-pair is refused.
    if ("framedWidthCm" in values || "framedHeightCm" in values) refineFramedSize(values, ctx);
  });

/** Lot rows nested under `POST /sales` (no `saleId`; set server-side). */
export const createNestedLotForSaleSchema = z.preprocess(
  normalizeCategoryIdsInput,
  createLotBodySchema.omit({ saleId: true }).extend({ sellerId: z.string().min(1).max(191) }),
);

export type CreateNestedLotForSaleInput = z.infer<typeof createNestedLotForSaleSchema>;

export const lotIdParamSchema = z.object({
  id: z.string().uuid(),
});
