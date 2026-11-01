import { SaleCoverTab } from "@/components/admin/sale-cover/sale-cover-tab";
import { loadAdminSaleCoverPage } from "@/lib/admin/sales/load-sale-cover-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS, SALE_CATALOG_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSaleCoverPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAdminCapability(SALE_CATALOG_READ_ACCESS, `/admin/sales/${id}`);
  const page = await loadAdminSaleCoverPage(id);
  const canEdit = userHasAccessTo(user.role as UserRole, user.staffRoles, SALES_ACCESS);

  return (
    <SaleCoverTab
      saleId={page.saleId}
      saleTitle={page.saleTitle}
      saleStatus={page.saleStatus}
      view={page.view}
      lots={page.lots}
      canEdit={canEdit}
    />
  );
}
