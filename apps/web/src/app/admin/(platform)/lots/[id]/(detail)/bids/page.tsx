import { LotBidsTabBoard } from "@/components/admin/lot-detail/lot-bids-tab-board";
import { loadAdminLotBidsPage } from "@/lib/admin/lots/load-lot-bids-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminLotBidsPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminLotBidsPage(id);

  return <LotBidsTabBoard lotId={page.lotId} rows={page.rows} capped={page.capped} />;
}
