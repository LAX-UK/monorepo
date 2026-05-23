import { LotImageTab } from "@/components/admin/lot-image-tab";
import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminLotImagesPage({ params }: Props) {
  const { id } = await params;
  const { auction } = await loadAdminLotDetail(id);
  const imageAlts = auction.marketingDetails.imageAlts ?? [];

  return <LotImageTab lotId={id} initialImages={auction.images} initialAlts={imageAlts} />;
}
