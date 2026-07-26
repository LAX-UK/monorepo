import { LotActivityTabBoard } from "@/components/admin/lot-detail/lot-activity-tab-board";
import { loadAdminLotActivityPage } from "@/lib/admin/lots/load-lot-activity-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminLotActivityPage({ params }: Props) {
  const { id } = await params;
  const model = await loadAdminLotActivityPage(id);
  return <LotActivityTabBoard lotId={model.lotId} events={model.events} />;
}
