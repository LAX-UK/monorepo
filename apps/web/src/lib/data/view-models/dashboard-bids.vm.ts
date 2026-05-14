import { buildBidBoardRows } from "@/components/dashboard/bid-board-rows";
import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";

/** Latest bid per lot, ordered by lot end time (ascending). */
export function buildDashboardBidsBoardVm(
  rows: BidWithLot[],
  userId: string | undefined,
  now: number,
): ReturnType<typeof buildBidBoardRows> {
  const latestByLot = new Map<string, BidWithLot>();
  for (const row of rows) {
    const prev = latestByLot.get(row.bid.lotId);
    if (!prev || row.bid.createdAt > prev.bid.createdAt) {
      latestByLot.set(row.bid.lotId, row);
    }
  }
  const unique = [...latestByLot.values()].sort((a, b) => {
    const ae = a.lot?.endTime.getTime() ?? 0;
    const be = b.lot?.endTime.getTime() ?? 0;
    return ae - be;
  });
  return buildBidBoardRows(unique, userId, now);
}
