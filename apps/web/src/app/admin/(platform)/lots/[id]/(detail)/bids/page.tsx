import { LotBidsTabBoard } from "@/components/admin/lot-detail/lot-bids-tab-board";
import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import { getAdminUsersByIds } from "@/lib/data/http/admin.server";
import { getServerLotBids } from "@/lib/data/http/lots.server";
import { buildLotBidsTableRows } from "@/lib/data/view-models/lot-bids-tab.vm";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminLotBidsPage({ params }: Props) {
  const { id } = await params;
  await loadAdminLotDetail(id);
  const bids = await getServerLotBids(id, 100).catch(() => []);
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

  return (
    <LotBidsTabBoard
      lotId={id}
      rows={buildLotBidsTableRows(bids, bidderLabels)}
      capped={bids.length >= 100}
    />
  );
}
