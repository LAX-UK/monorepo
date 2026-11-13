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

/** A sale's seller figures as its seller-terms snapshot recorded them, in whole pence. */
export const sellerTermsFiguresSchema = z.object({
  hammerPence: z.number().int(),
  commissionBps: z.number().int(),
  commissionPence: z.number().int(),
  vatTreatment: z.enum(["standard", "not_registered"]),
  vatBps: z.number().int(),
  vatPence: z.number().int(),
  netPence: z.number().int(),
});
export type SellerTermsFiguresView = z.infer<typeof sellerTermsFiguresSchema>;

export const soldLotSchema = z.object({
  lotId: z.string(),
  lotTitle: z.string(),
  lotNumber: z.number().nullable(),
  saleTitle: z.string().nullable(),
  soldAt: zCoerceDate,
  hammerPrice: z.string(),
  /** The first buyer did not pay and the lot was sold on to the next bidder. */
  soldAfterAuction: z.boolean().default(false),
  stage: z.enum(SOLD_LOT_STAGES),
  net: z.string().nullable(),
  /** The snapshot `net` comes from, as recorded; `null` for a sale paid under the old rule. */
  sellerTerms: sellerTermsFiguresSchema.nullable().default(null),
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
  /** The snapshot a sale line pays, as recorded; `null` on lines paid under the old rule. */
  sellerTerms: sellerTermsFiguresSchema.nullable().default(null),
  soldAfterAuction: z.boolean().default(false),
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
