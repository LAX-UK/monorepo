import { SaleAtgTab } from "@/components/admin/sale-detail/tabs/atg-tab";
import { loadAdminSaleAtgPage } from "@/lib/admin/sales/load-sale-atg-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSaleAtgPage({ params }: Props) {
  const { id } = await params;
  await requireAdminCapability(SALES_ACCESS, `/admin/sales/${id}`);
  const page = await loadAdminSaleAtgPage(id);
  if (!page) notFound();

  return <SaleAtgTab saleId={page.saleId} status={page.status} view={page.view} canManage />;
}
