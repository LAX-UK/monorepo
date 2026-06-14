import type { BidUpdateEvent } from "@auction/types";

/** API Redis payload wraps the bid record (`bid`) plus `currentPrice`. */
export function parseBidUpdateEvent(raw: unknown): BidUpdateEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lotId =
    typeof o.lotId === "string" ? o.lotId : typeof o.auctionId === "string" ? o.auctionId : null;
  const bid = o.bid as Record<string, unknown> | undefined;
  if (
    lotId &&
    typeof o.currentPrice === "string" &&
    bid &&
    typeof bid.id === "string" &&
    typeof bid.bidderId === "string" &&
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
      bidderId: bid.bidderId,
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
    };
  }
  return null;
}
