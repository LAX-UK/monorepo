import { OnsiteOperationsCommandCenter } from "@/components/admin/sale-detail/onsite-operations-command-center";
import { isSaleLiveish } from "@/components/admin/sale-detail/sale-detail-helpers";
import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import { getAdminSaleOperationsSnapshot } from "@/lib/data/http/admin.server";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSaleOperationsPage({ params }: Props) {
  const { id } = await params;
  const bundle = await loadAdminSaleDetail(id);
  if (!isSaleroomDeliveryMode(bundle.sale.deliveryMode)) notFound();

  const snapshot = await getAdminSaleOperationsSnapshot(id).catch(() => null);
  const liveish = isSaleLiveish(bundle.sale);

  return (
    <OnsiteOperationsCommandCenter
      saleId={id}
      sale={bundle.sale}
      liveish={liveish}
      snapshot={snapshot}
    />
  );
}
