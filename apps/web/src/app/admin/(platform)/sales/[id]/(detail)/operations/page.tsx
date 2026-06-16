import { SaleroomOperationsCommandCenter } from "@/components/admin/sale-detail/onsite-operations-command-center";
import { isSaleLiveish } from "@/components/admin/sale-detail/sale-detail-helpers";
import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import {
  getAdminSaleOperationsSnapshot,
  getAdminSalePaddleRoster,
} from "@/lib/data/http/admin.server";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSaleOperationsPage({ params }: Props) {
  const { id } = await params;
  const bundle = await loadAdminSaleDetail(id);
  if (!isSaleroomDeliveryMode(bundle.sale.deliveryMode)) notFound();

  const [snapshot, paddleRoster] = await Promise.all([
    getAdminSaleOperationsSnapshot(id).catch(() => null),
    getAdminSalePaddleRoster(id).catch(() => []),
  ]);
  const liveish = isSaleLiveish(bundle.sale);

  return (
    <SaleroomOperationsCommandCenter
      saleId={id}
      sale={bundle.sale}
      liveish={liveish}
      snapshot={snapshot}
      paddleRoster={paddleRoster}
      lots={bundle.lots}
    />
  );
}
