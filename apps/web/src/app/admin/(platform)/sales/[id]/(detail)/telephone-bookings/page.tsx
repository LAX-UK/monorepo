import { isSaleLiveish } from "@/components/admin/sale-detail/sale-detail-helpers";
import { SaleTelephoneBookingsTab } from "@/components/admin/sale-detail/tabs/telephone-bookings-tab";
import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminTelephoneBookings } from "@/lib/data/http/admin.server";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminSaleTelephoneBookingsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const bundle = await loadAdminSaleDetail(id);
  if (!isSaleroomDeliveryMode(bundle.sale.deliveryMode)) notFound();
  const liveish = isSaleLiveish(bundle.sale);

  const bookingsResult = liveish
    ? await getAdminTelephoneBookings(id)
        .then((rows) => ({ rows, error: null as string | null }))
        .catch((err) => ({
          rows: [],
          error: err instanceof Error ? err.message : "Failed to load telephone bookings.",
        }))
    : { rows: [], error: null as string | null };

  return (
    <SaleTelephoneBookingsTab
      saleId={id}
      sale={bundle.sale}
      liveish={liveish}
      rows={bookingsResult.rows}
      fetchError={bookingsResult.error}
      actionError={sp.error ? safeDecodeAdminErrorParam(sp.error) : null}
    />
  );
}
