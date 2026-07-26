import "server-only";

import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import { isSaleLiveish } from "@/lib/admin/sales/sale-detail-helpers";
import { getAdminTelephoneBookings } from "@/lib/data/http/admin.server";
import type { AdminTelephoneBookingRow } from "@/lib/telephone/telephone-booking-types";
import type { Sale } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";

export type SaleTelephoneBookingsPageModel = {
  saleId: string;
  sale: Sale;
  liveish: boolean;
  rows: AdminTelephoneBookingRow[];
  fetchError: string | null;
  notFound: boolean;
};

/** Data/composition boundary for `/admin/sales/[id]/telephone-bookings`. */
export async function loadAdminSaleTelephoneBookingsPage(
  saleId: string,
): Promise<SaleTelephoneBookingsPageModel> {
  const bundle = await loadAdminSaleDetail(saleId).catch(() => null);
  if (!bundle || !isSaleroomDeliveryMode(bundle.sale.deliveryMode)) {
    return {
      saleId,
      sale: bundle?.sale ?? ({} as Sale),
      liveish: false,
      rows: [],
      fetchError: null,
      notFound: true,
    };
  }

  const liveish = isSaleLiveish(bundle.sale);

  const bookingsResult = liveish
    ? await getAdminTelephoneBookings(saleId)
        .then((rows) => ({ rows, error: null as string | null }))
        .catch((err) => ({
          rows: [] as AdminTelephoneBookingRow[],
          error: err instanceof Error ? err.message : "Failed to load telephone bookings.",
        }))
    : { rows: [] as AdminTelephoneBookingRow[], error: null as string | null };

  return {
    saleId,
    sale: bundle.sale,
    liveish,
    rows: bookingsResult.rows,
    fetchError: bookingsResult.error,
    notFound: false,
  };
}
