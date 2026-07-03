import { toObjectRecord } from "@/lib/data/http/object-guards";
import type { SellerPayoutPendingPreview } from "@/lib/data/http/seller-payouts.types";
import type { Payout } from "@auction/types";
import { z } from "zod";

export const sellerPayoutPendingPreviewSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (row): SellerPayoutPendingPreview => ({
      pendingGross: String(row.pendingGross ?? ""),
      pendingPlatformFee: String(row.pendingPlatformFee ?? ""),
      pendingNet: String(row.pendingNet ?? ""),
      paymentCount: Number(row.paymentCount ?? 0),
      currency: String(row.currency ?? ""),
    }),
  ) as z.ZodType<SellerPayoutPendingPreview>;

/** API JSON returns ISO strings; hydrate to `Date` for `Payout` consumers. */
export const payoutFromApiSchema = z.custom<Payout>((raw) => {
  const row = raw as Payout;
  return {
    ...row,
    periodStart: new Date(row.periodStart),
    periodEnd: new Date(row.periodEnd),
    processedAt: row.processedAt ? new Date(row.processedAt) : null,
    createdAt: new Date(row.createdAt),
  };
}) as z.ZodType<Payout>;
