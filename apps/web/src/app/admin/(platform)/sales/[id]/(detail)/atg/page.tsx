import { SaleAtgTab } from "@/components/admin/sale-detail/tabs/atg-tab";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getAtgIntegrationStatus, getAtgSaleSyncView } from "@/lib/data/http/atg.server";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSaleAtgPage({ params }: Props) {
  const { id } = await params;
  await requireAdminCapability(SALES_ACCESS, `/admin/sales/${id}`);
  const [status, view] = await Promise.all([getAtgIntegrationStatus(), getAtgSaleSyncView(id)]);
  if (!view) notFound();

  return <SaleAtgTab saleId={id} status={status} view={view} canManage />;
}
