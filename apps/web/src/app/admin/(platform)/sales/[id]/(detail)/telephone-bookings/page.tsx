import { SaleTelephoneBookingsTab } from "@/components/admin/sale-detail/tabs/telephone-bookings-tab";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { loadAdminSaleTelephoneBookingsPage } from "@/lib/admin/sales/load-sale-telephone-bookings-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminSaleTelephoneBookingsPage({ params, searchParams }: Props) {
  const { id } = await params;
  await requireAdminCapability(SALES_ACCESS, `/admin/sales/${id}`);
  const sp = await searchParams;
  const page = await loadAdminSaleTelephoneBookingsPage(id);
  if (page.notFound) notFound();

  return (
    <SaleTelephoneBookingsTab
      saleId={page.saleId}
      sale={page.sale}
      liveish={page.liveish}
      rows={page.rows}
      fetchError={page.fetchError}
      actionError={sp.error ? safeDecodeAdminErrorParam(sp.error) : null}
    />
  );
}
