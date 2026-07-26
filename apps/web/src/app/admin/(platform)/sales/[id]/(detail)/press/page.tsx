import { SalePressTab } from "@/components/admin/sale-detail/tabs/press-tab";
import { loadAdminSalePressPage } from "@/lib/admin/sales/load-sale-press-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS, SALE_CATALOG_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSalePressPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAdminCapability(SALE_CATALOG_ACCESS, `/admin/sales/${id}`);
  const page = await loadAdminSalePressPage(id);

  const canManage = userHasAccessTo(user.role as UserRole, user.staffRole ?? null, SALES_ACCESS);

  return (
    <SalePressTab
      saleId={page.saleId}
      initialPressCoverage={page.initialPressCoverage}
      canManage={canManage}
    />
  );
}
