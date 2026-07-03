import { z } from "zod";
import {
  normalizeOptionalCategoryIdsInput,
  refineSaleCreateBody,
  refineSaleUpdateBody,
  saleCreateBodySchema,
} from "./shared-fields.js";

export const createSaleSchema = z.preprocess(
  normalizeOptionalCategoryIdsInput,
  saleCreateBodySchema.superRefine(refineSaleCreateBody),
);

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const updateSaleSchema = z.preprocess(
  normalizeOptionalCategoryIdsInput,
  saleCreateBodySchema
    .partial()
    .omit({ lots: true })
    .superRefine((data, ctx) => {
      refineSaleUpdateBody(data, ctx);
    }),
);
