import { formatBidPlacementBadgeLabel, getBidPlacement } from "@/lib/bid/bid-placement-presenter";
import type { Bid } from "@auction/types";
import { StatusBadge } from "@auction/ui/components/status-badge";

type Props = {
  bid: Pick<Bid, "placedVia" | "clerkUserId">;
  size?: "sm" | "md";
};

export function BidPlacementBadge({ bid, size = "sm" }: Props) {
  const placement = getBidPlacement(bid);
  const label = formatBidPlacementBadgeLabel(placement);
  if (!label) return null;

  return (
    <StatusBadge variant="neutral" size={size} title={label}>
      {label}
    </StatusBadge>
  );
}
