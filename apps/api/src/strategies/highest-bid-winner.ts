import type { Bid } from "@auction/types";

/** Highest amount wins; earliest bid breaks ties (same semantics as sealed-bid settlement). */
export function determineHighestBid(bids: Bid[]): Bid | null {
  if (bids.length === 0) return null;
  let best = bids[0]!;
  for (const b of bids.slice(1)) {
    const amt = Number(b.amount);
    const bestAmt = Number(best.amount);
    if (amt > bestAmt || (amt === bestAmt && b.createdAt.getTime() < best.createdAt.getTime())) {
      best = b;
    }
  }
  return best;
}
