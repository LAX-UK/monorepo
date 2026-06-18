import { formatBidChannelLabel } from "@/lib/bid/bid-channel-label";
import type { Bid } from "@auction/types";

export type BidPlacement = {
  onBehalf: boolean;
  channelLabel: string | null;
};

/** Whether a bid was placed by staff on the buyer's behalf (floor, telephone, or clerk-assisted). */
export function getBidPlacement(bid: Pick<Bid, "placedVia" | "clerkUserId">): BidPlacement {
  const channelLabel = formatBidChannelLabel(bid.placedVia);
  const onBehalf =
    bid.clerkUserId != null || bid.placedVia === "saleroom" || bid.placedVia === "telephone";
  return { onBehalf, channelLabel };
}

export function formatBidPlacementBadgeLabel(placement: BidPlacement): string {
  if (!placement.onBehalf) return "";
  return placement.channelLabel
    ? `Bid placed for you · ${placement.channelLabel}`
    : "Bid placed for you";
}
