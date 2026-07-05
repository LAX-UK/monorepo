import type { Bid } from "@auction/types";

/** Highest amount wins; earliest bid breaks ties (same semantics as sealed-bid settlement). */
export function determineHighestBid(bids: Bid[]): Bid | null {
  const [first, ...rest] = bids;
  if (!first) return null;
  let best = first;
  for (const b of rest) {
    const amt = Number(b.amount);
    const bestAmt = Number(best.amount);
    if (amt > bestAmt || (amt === bestAmt && b.createdAt.getTime() < best.createdAt.getTime())) {
      best = b;
    }
  }
  return best;
}
