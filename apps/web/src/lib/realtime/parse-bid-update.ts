import type { BidUpdateEvent } from "@auction/types";

/** API Redis payload wraps the bid record (`bid`) plus `currentPrice`. */
export function parseBidUpdateEvent(raw: unknown): BidUpdateEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lotId =
    typeof o.lotId === "string" ? o.lotId : typeof o.auctionId === "string" ? o.auctionId : null;
  const bid = o.bid as Record<string, unknown> | undefined;
  const bidderId =
    bid && typeof bid.bidderId === "string"
      ? bid.bidderId
      : bid && typeof bid.placedByUserId === "string"
        ? bid.placedByUserId
        : null;
  if (
    lotId &&
    typeof o.currentPrice === "string" &&
    bid &&
    typeof bid.id === "string" &&
    bidderId &&
    typeof bid.amount === "string"
  ) {
    const placedByUserId =
      typeof bid.placedByUserId === "string"
        ? bid.placedByUserId
        : typeof bid.bidderId === "string"
          ? bid.bidderId
          : undefined;
    return {
      lotId,
      bidId: bid.id,
      bidderId,
      amount: bid.amount,
      currentPrice: o.currentPrice,
      endTime: typeof o.endTime === "string" ? o.endTime : undefined,
      outbidUserId: typeof o.outbidUserId === "string" ? o.outbidUserId : undefined,
      emittedAt:
        typeof o.emittedAt === "number" && Number.isFinite(o.emittedAt) ? o.emittedAt : undefined,
      isAutoBid: bid.isAutoBid === true,
      placedByUserId,
      autoBidStepAmount:
        typeof bid.autoBidStepAmount === "string" ? bid.autoBidStepAmount : undefined,
      placedVia: typeof bid.placedVia === "string" ? bid.placedVia : undefined,
      bidCount:
        typeof o.bidCount === "number" && Number.isFinite(o.bidCount) ? o.bidCount : undefined,
    };
  }
  return null;
}
