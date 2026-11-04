import { SaleRegistrationsTab } from "@/components/admin/sale-detail/tabs/registrations-tab";
import { loadAdminSaleRegistrationsPage } from "@/lib/admin/sales/load-sale-registrations-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSaleRegistrationsPage({ params }: Props) {
  const { id } = await params;
  await requireAdminCapability(SALES_ACCESS, `/admin/sales/${id}`);
  const page = await loadAdminSaleRegistrationsPage(id);

  return (
    <SaleRegistrationsTab
      saleId={page.saleId}
      sale={page.sale}
      liveish={page.liveish}
      rows={page.rows}
      fetchError={page.fetchError}
      saleCurrency={page.saleCurrency}
      expectedGuests={page.expectedGuests}
    />
  );
}
