import type { Lot } from "@auction/types";

/** Min next bid amount (same rules as the bid panel / bid form). */
export function getMinNextBidAmount(auction: Lot, currentPriceStr: string): number {
  const cur = Number.parseFloat(currentPriceStr);
  if (auction.auctionType === "dutch") return cur;
  const start = Number.parseFloat(auction.startingPrice);
  const inc = Number.parseFloat(auction.minBidIncrement);
  const step = Number.isFinite(inc) && inc > 0 ? inc : 0.01;
  const next = cur + step;
  if (auction.auctionType === "sealed") {
    return Number.isFinite(start) ? Math.max(next, start) : next;
  }
  return next;
}
