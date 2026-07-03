import { toObjectRecord } from "@/lib/data/http/object-guards";
import { zCoerceDate, zNullableStringFromEmpty } from "@/lib/data/http/schema-coerce";
import type { Bid } from "@auction/types";
import { z } from "zod";

const bidRowSchema = z.preprocess(toObjectRecord, z.record(z.unknown())).transform((row): Bid => {
  const placedByUserId =
    row.placedByUserId == null || row.placedByUserId === ""
      ? undefined
      : String(row.placedByUserId);
  const bidderId =
    row.bidderId == null || row.bidderId === "" ? placedByUserId : String(row.bidderId);
  const placedVia = zNullableStringFromEmpty.parse(row.placedVia);
  const clerkUserId = zNullableStringFromEmpty.parse(row.clerkUserId);

  return {
    id: String(row.id),
    lotId: String(row.lotId ?? row.auctionId),
    ...(bidderId ? { bidderId } : {}),
    ...(placedByUserId ? { placedByUserId } : {}),
    amount: String(row.amount),
    isWinning: Boolean(row.isWinning),
    isAutoBid: Boolean(row.isAutoBid),
    maxAutoBidAmount: row.maxAutoBidAmount == null ? null : String(row.maxAutoBidAmount),
    autoBidStepAmount: row.autoBidStepAmount == null ? null : String(row.autoBidStepAmount),
    placedVia,
    clerkUserId,
    createdAt: zCoerceDate.parse(row.createdAt),
  };
});

export const bidSchema = bidRowSchema as z.ZodType<Bid>;

export function parseBidSchema(raw: unknown): Bid {
  return bidSchema.parse(raw);
}

type _BidInfer = z.infer<typeof bidSchema>;
const _bidTypeGuard = null as unknown as _BidInfer satisfies Bid;
void _bidTypeGuard;
