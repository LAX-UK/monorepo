import { SaleRegistrationsTab } from "@/components/admin/sale-detail/tabs/registrations-tab";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { loadAdminSaleRegistrationsPage } from "@/lib/admin/sales/load-sale-registrations-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminSaleRegistrationsPage({ params, searchParams }: Props) {
  const { id } = await params;
  await requireAdminCapability(SALES_ACCESS, `/admin/sales/${id}`);
  const sp = await searchParams;
  const page = await loadAdminSaleRegistrationsPage(id);

  return (
    <SaleRegistrationsTab
      saleId={page.saleId}
      sale={page.sale}
      liveish={page.liveish}
      rows={page.rows}
      fetchError={page.fetchError}
      actionError={sp.error ? safeDecodeAdminErrorParam(sp.error) : null}
      saleCurrency={page.saleCurrency}
      expectedGuests={page.expectedGuests}
    />
  );
}
