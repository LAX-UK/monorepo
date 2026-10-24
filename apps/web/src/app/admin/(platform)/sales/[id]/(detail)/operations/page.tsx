import { SaleroomOperationsCommandCenter } from "@/components/admin/sale-detail/onsite-operations-command-center";
import { loadSaleroomOperationsPage } from "@/lib/admin/saleroom/load-saleroom-operations-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSaleOperationsPage({ params }: Props) {
  const { id } = await params;
  await requireAdminCapability(SALES_ACCESS, `/admin/sales/${id}`);
  const model = await loadSaleroomOperationsPage(id);
  if (model.notFound) notFound();

  return (
    <SaleroomOperationsCommandCenter
      saleId={id}
      sale={model.sale}
      liveish={model.liveish}
      snapshot={model.snapshot}
      paddleRoster={model.paddleRoster}
      lots={model.lots}
    />
  );
}
