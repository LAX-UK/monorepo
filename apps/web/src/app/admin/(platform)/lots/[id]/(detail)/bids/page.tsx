import { AdminLotBidsTable } from "@/components/admin/admin-lot-bids-table";
import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import { getServerLotBids } from "@/lib/data/http/lots.server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminLotBidsPage({ params }: Props) {
  const { id } = await params;
  await loadAdminLotDetail(id);
  const bids = await getServerLotBids(id, 100).catch(() => []);

  return <AdminLotBidsTable lotId={id} bids={bids} capped={bids.length >= 100} />;
}
