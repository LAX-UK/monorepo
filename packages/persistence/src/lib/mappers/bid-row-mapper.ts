import type { bid } from "@auction/db/schema";
import type { Bid } from "@auction/types";
import type { InferSelectModel } from "drizzle-orm";

type BidRow = InferSelectModel<typeof bid>;

function requireBackfilledLegalEntityId(value: string | null, context: string): string {
  if (!value) {
    throw new Error(`missing_backfilled_legal_entity_id:${context}`);
  }
  return value;
}

export function mapBidRow(row: BidRow): Bid {
  return {
    id: row.id,
    lotId: row.lotId,
    bidderId: row.bidderId,
    placedByUserId: row.bidderId,
    buyerLegalEntityId: requireBackfilledLegalEntityId(row.buyerLegalEntityId, `bid:${row.id}`),
    amount: String(row.amount),
    isWinning: row.isWinning,
    isAutoBid: row.isAutoBid,
    maxAutoBidAmount: row.maxAutoBidAmount !== null ? String(row.maxAutoBidAmount) : null,
    autoBidStepAmount: row.autoBidStepAmount !== null ? String(row.autoBidStepAmount) : null,
    placedVia: row.placedVia ?? null,
    telephoneBookingId: row.telephoneBookingId ?? null,
    clerkUserId: row.clerkUserId ?? null,
    createdAt: row.createdAt,
  };
}

export type { BidRow };
