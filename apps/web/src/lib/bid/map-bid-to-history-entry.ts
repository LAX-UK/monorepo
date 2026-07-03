import type { BidHistoryEntry } from "@/lib/bid/bid-history-entry";
import type { Bid } from "@auction/types";

export function mapBidToHistoryEntry(bid: Bid): BidHistoryEntry {
  return {
    id: bid.id,
    bidderId: bid.bidderId ?? bid.placedByUserId ?? "",
    amount: bid.amount,
    at: bid.createdAt.getTime(),
    ...(bid.isAutoBid ? { isAutoBid: true } : {}),
    ...(bid.placedVia ? { placedVia: bid.placedVia } : {}),
  };
}
