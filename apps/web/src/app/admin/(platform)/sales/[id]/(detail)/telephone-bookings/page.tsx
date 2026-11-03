import { SaleTelephoneBookingsTab } from "@/components/admin/sale-detail/tabs/telephone-bookings-tab";
import { loadAdminSaleTelephoneBookingsPage } from "@/lib/admin/sales/load-sale-telephone-bookings-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSaleTelephoneBookingsPage({ params }: Props) {
  const { id } = await params;
  await requireAdminCapability(SALES_ACCESS, `/admin/sales/${id}`);
  const page = await loadAdminSaleTelephoneBookingsPage(id);
  if (page.notFound) notFound();

  return (
    <SaleTelephoneBookingsTab
      saleId={page.saleId}
      sale={page.sale}
      liveish={page.liveish}
      rows={page.rows}
      fetchError={page.fetchError}
    />
  );
}
