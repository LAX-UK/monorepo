import { LotImagesTabBoard } from "@/components/admin/lot-detail/lot-images-tab-board";
import { loadAdminLotImagesPage } from "@/lib/admin/lots/load-lot-images-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminLotImagesPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminLotImagesPage(id);

  return (
    <LotImagesTabBoard
      lotId={page.lotId}
      initialImages={page.images}
      initialAlts={page.imageAlts}
    />
  );
}
