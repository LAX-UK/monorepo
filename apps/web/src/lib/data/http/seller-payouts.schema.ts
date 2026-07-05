import { toObjectRecord } from "@/lib/data/http/object-guards";
import { zCoerceDate, zNullableStringFromEmpty } from "@/lib/data/http/schema-coerce";
import type { SellerPayoutPendingPreview } from "@/lib/data/http/seller-payouts.types";
import type { Payout, PayoutStatus } from "@auction/types";
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

function parsePayoutRow(row: Record<string, unknown>): Payout {
  return {
    id: String(row.id ?? ""),
    legalEntityId: String(row.legalEntityId ?? ""),
    periodStart: zCoerceDate.parse(row.periodStart),
    periodEnd: zCoerceDate.parse(row.periodEnd),
    grossAmount: String(row.grossAmount ?? ""),
    platformFee: String(row.platformFee ?? ""),
    stripeFee: String(row.stripeFee ?? ""),
    netAmount: String(row.netAmount ?? ""),
    currency: String(row.currency ?? ""),
    status: String(row.status ?? "scheduled") as PayoutStatus,
    stripeTransferId: zNullableStringFromEmpty.parse(row.stripeTransferId),
    xeroBillId: zNullableStringFromEmpty.parse(row.xeroBillId),
    failureReason: zNullableStringFromEmpty.parse(row.failureReason),
    processedAt:
      row.processedAt == null || row.processedAt === "" ? null : zCoerceDate.parse(row.processedAt),
    statementUrl: zNullableStringFromEmpty.parse(row.statementUrl),
    statementGenerationError: zNullableStringFromEmpty.parse(row.statementGenerationError),
    createdAt: zCoerceDate.parse(row.createdAt),
  };
}

/** API JSON returns ISO strings; hydrate to `Date` for `Payout` consumers. */
export const payoutFromApiSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(parsePayoutRow) as z.ZodType<Payout>;

/** Parse a single payout row outside list envelopes (tests, client adapters). */
export function parsePayoutFromApi(raw: unknown): Payout {
  return payoutFromApiSchema.parse(raw);
}
