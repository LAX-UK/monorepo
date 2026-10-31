import { zCoerceDate } from "@/lib/data/http/schema-coerce";
import { z } from "zod";

/** The shapes of the acting account's selling reads (`/legal-entities/…`). */

export const SOLD_LOT_STAGES = [
  "buyer_paying",
  "paid_by_buyer",
  "in_payout",
  "paid_out",
  "payout_problem",
  "refunded",
] as const;

export const soldLotSchema = z.object({
  lotId: z.string(),
  lotTitle: z.string(),
  lotNumber: z.number().nullable(),
  saleTitle: z.string().nullable(),
  soldAt: zCoerceDate,
  hammerPrice: z.string(),
  stage: z.enum(SOLD_LOT_STAGES),
  net: z.string().nullable(),
  payout: z.object({ id: z.string(), settledAt: zCoerceDate.nullable() }).nullable(),
});
export type SoldLot = z.infer<typeof soldLotSchema>;

const breakdownSchema = z.object({
  gross: z.string(),
  commissionAndFees: z.string(),
  net: z.string(),
});

const payoutLineSchema = z.object({
  id: z.string(),
  kind: z.string(),
  note: z.string().nullable(),
  lot: z
    .object({
      id: z.string(),
      title: z.string(),
      lotNumber: z.number().nullable(),
      hammerPrice: z.string(),
    })
    .nullable(),
  breakdown: breakdownSchema.nullable(),
  amount: z.string(),
});
export type PayoutLine = z.infer<typeof payoutLineSchema>;

export const payoutDetailSchema = z.object({
  id: z.string(),
  status: z.string(),
  currency: z.string(),
  grossAmount: z.string(),
  platformFee: z.string(),
  stripeFee: z.string(),
  netAmount: z.string(),
  periodStart: zCoerceDate,
  periodEnd: zCoerceDate,
  processedAt: zCoerceDate.nullable(),
  lines: z.array(payoutLineSchema),
});
export type PayoutDetail = z.infer<typeof payoutDetailSchema>;

export const returnedWorkSchema = z.object({
  submissionId: z.string(),
  lotId: z.string(),
  title: z.string(),
  medium: z.string().nullable(),
  reference: z.string(),
  returnedAt: zCoerceDate.nullable(),
  canConsignAgain: z.boolean(),
});
export type ReturnedWork = z.infer<typeof returnedWorkSchema>;
