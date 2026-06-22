import { SalePressTab } from "@/components/admin/sale-detail/tabs/press-tab";
import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSalePressPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAdminCapability(SALES_ACCESS, `/admin/sales/${id}`);
  const bundle = await loadAdminSaleDetail(id);
  const { sale } = bundle;

  const canManage = userHasAccessTo(user.role as UserRole, user.staffRole ?? null, SALES_ACCESS);

  return (
    <SalePressTab
      saleId={id}
      initialPressCoverage={sale.pressCoverage ?? []}
      canManage={canManage}
    />
  );
}
