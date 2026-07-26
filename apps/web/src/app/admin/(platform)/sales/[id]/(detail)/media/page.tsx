import { SaleDayPhotosTab } from "@/components/admin/sale-detail/tabs/day-photos-tab";
import { loadAdminSaleMediaPage } from "@/lib/admin/sales/load-sale-media-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS, SALE_CATALOG_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSaleMediaPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAdminCapability(SALE_CATALOG_ACCESS, `/admin/sales/${id}`);
  const page = await loadAdminSaleMediaPage(id);
  if (page.notFound) notFound();

  const canManage = userHasAccessTo(user.role as UserRole, user.staffRole ?? null, SALES_ACCESS);

  return (
    <SaleDayPhotosTab
      saleId={page.saleId}
      saleTitle={page.saleTitle}
      saleStatus={page.saleStatus}
      initialDayImages={page.initialDayImages}
      previewUrlByKey={page.previewUrlByKey}
      canManage={canManage}
    />
  );
}
