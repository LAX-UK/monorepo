import "server-only";

import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import { type BidStanding, bidStandings } from "@/lib/admin/reoffer/bid-standing";
import { getLotReofferBundle } from "@/lib/data/http/admin-reoffers.server";
import { getAdminUsersByIds } from "@/lib/data/http/admin.server";
import { getServerLotBids } from "@/lib/data/http/lots.server";
import { type LotBidTableRow, buildLotBidsTableRows } from "@/lib/data/view-models/lot-bids-tab.vm";

export type LotBidsPageModel = {
  lotId: string;
  rows: LotBidTableRow[];
  capped: boolean;
  /** Bids an offer or the buyer default changed, by bid id. */
  standings: Record<string, BidStanding>;
};

/** Data/composition boundary for `/admin/lots/[id]/bids`. */
export async function loadAdminLotBidsPage(lotId: string): Promise<LotBidsPageModel> {
  await loadAdminLotDetail(lotId);
  const [bids, reoffers] = await Promise.all([
    getServerLotBids(lotId, 100).catch(() => []),
    getLotReofferBundle(lotId),
  ]);
  const bidderIds = [
    ...new Set(
      bids.map((bid) => bid.bidderId).filter((bidderId): bidderId is string => Boolean(bidderId)),
    ),
  ];
  const bidders = await getAdminUsersByIds(bidderIds).catch(() => []);
  const bidderLabels = Object.fromEntries(
    bidders
      .map((user) => [user.id, user.name || user.email] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );

  return {
    lotId,
    rows: buildLotBidsTableRows(bids, bidderLabels),
    capped: bids.length >= 100,
    standings: bidStandings(
      reoffers,
      bids.map((bid) => ({ id: bid.id, bidderId: bid.bidderId ?? null, amount: bid.amount })),
    ),
  };
}
