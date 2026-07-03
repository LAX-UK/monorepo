import type {
  ArtistFollowRow,
  BidWithLot,
  WatchlistListParams,
  WatchlistWithLotRow,
} from "@/lib/data/dto/dashboard-dtos";
import { bidSchema } from "@/lib/data/http/bid.schema";
import { lotSchema } from "@/lib/data/http/lot.schema";
import { toObjectRecord } from "@/lib/data/http/object-guards";
import { zCoerceDate } from "@/lib/data/http/schema-coerce";
import type { ManualReviewReason, PaymentStatus, PortfolioRow } from "@auction/types";
import { z } from "zod";

export type { ArtistFollowRow, BidWithLot, WatchlistListParams, WatchlistWithLotRow };

const paymentStatusSchema = z.enum([
  "pending",
  "authorized",
  "captured",
  "refunded",
  "requires_manual_review",
]);

const manualReviewReasonSchema = z.enum([
  "seller_archived",
  "high_value",
  "seller_archived_and_high_value",
  "aml_hold",
  "source_of_funds_required",
  "finance_release_required",
]);

const bidWithLotRowSchema = z.preprocess(toObjectRecord, z.record(z.unknown())).transform(
  (row): BidWithLot => ({
    bid: bidSchema.parse(row.bid),
    lot: row.lot == null ? null : lotSchema.parse(row.lot),
  }),
) as z.ZodType<BidWithLot>;

const portfolioRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): PortfolioRow => {
    const paymentRaw = row.payment;
    let payment: PortfolioRow["payment"] = null;
    if (paymentRaw != null && typeof paymentRaw === "object") {
      const p = paymentRaw as Record<string, unknown>;
      const statusResult = paymentStatusSchema.safeParse(p.status);
      if (statusResult.success) {
        const reasonResult = manualReviewReasonSchema.safeParse(p.manualReviewReason);
        payment = {
          id: String(p.id ?? ""),
          status: statusResult.data as PaymentStatus,
          manualReviewReason: reasonResult.success
            ? (reasonResult.data as ManualReviewReason)
            : null,
        };
      }
    }
    return {
      lot: lotSchema.parse(row.lot),
      payment,
    };
  }) as z.ZodType<PortfolioRow>;

const watchlistWithLotRowSchema = z.preprocess(toObjectRecord, z.record(z.unknown())).transform(
  (row): WatchlistWithLotRow => ({
    watchlistId: String(row.watchlistId ?? ""),
    lotId: String(row.lotId ?? ""),
    createdAt: zCoerceDate.parse(row.createdAt),
    lot: row.lot == null ? null : lotSchema.parse(row.lot),
  }),
) as z.ZodType<WatchlistWithLotRow>;

const artistFollowRowSchema = z.preprocess(toObjectRecord, z.record(z.unknown())).transform(
  (row): ArtistFollowRow => ({
    watchlistId: String(row.id ?? ""),
    artistId: String(row.artistId ?? ""),
    createdAt: zCoerceDate.parse(row.createdAt),
  }),
) as z.ZodType<ArtistFollowRow>;

export {
  bidWithLotRowSchema,
  portfolioRowSchema,
  watchlistWithLotRowSchema,
  artistFollowRowSchema,
};
