import { SaleRegistrationsTab } from "@/components/admin/sale-detail/tabs/registrations-tab";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { loadAdminSaleRegistrationsPage } from "@/lib/admin/sales/load-sale-registrations-page";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminSaleRegistrationsPage({ params, searchParams }: Props) {
  const { id } = await params;
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
