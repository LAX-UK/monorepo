import type { Bid } from "@auction/types";

/** For auto-bid panel: latest bid from this user with optional proxy settings.
 */
export function findUserLatestBidMeta(
  userId: string | undefined,
  bids: Pick<
    Bid,
    | "bidderId"
    | "placedByUserId"
    | "maxAutoBidAmount"
    | "autoBidStepAmount"
    | "createdAt"
    | "amount"
    | "id"
  >[],
): {
  maxAutoBidAmount: string | null;
  autoBidStepAmount: string | null;
  amount: string;
  bidId: string;
  isActive: boolean;
} | null {
  if (!userId) return null;
  const mine = bids.filter((b) => (b.bidderId ?? b.placedByUserId) === userId);
  if (mine.length === 0) return null;
  mine.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const latest = mine[0];
  if (!latest) return null;
  const max = latest.maxAutoBidAmount;
  return {
    maxAutoBidAmount: max,
    autoBidStepAmount: latest.autoBidStepAmount ?? null,
    amount: latest.amount,
    bidId: latest.id,
    isActive: max != null && max.trim() !== "",
  };
}
