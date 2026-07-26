import "server-only";

import { loadAdminSaleDetail, loadAdminSaleRegistrations } from "@/lib/admin/load-sale-detail";
import { isSaleLiveish } from "@/lib/admin/sales/sale-detail-helpers";
import { getAdminExpectedGuests } from "@/lib/data/http/admin-expected-guests.server";
import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin-sale-registrations.types";
import type { Sale } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";

export type SaleRegistrationsPageModel = {
  saleId: string;
  sale: Sale;
  liveish: boolean;
  rows: AdminSaleRegistrationRow[];
  fetchError: string | null;
  saleCurrency: string;
  expectedGuests: Awaited<ReturnType<typeof getAdminExpectedGuests>> | null;
};

/** Data/composition boundary for `/admin/sales/[id]/registrations`. */
export async function loadAdminSaleRegistrationsPage(
  saleId: string,
): Promise<SaleRegistrationsPageModel> {
  const bundle = await loadAdminSaleDetail(saleId);
  const liveish = isSaleLiveish(bundle.sale);

  const registrationsResult = liveish
    ? await loadAdminSaleRegistrations(saleId)
        .then((rows) => ({ rows, error: null as string | null }))
        .catch((err) => ({
          rows: [] as AdminSaleRegistrationRow[],
          error: err instanceof Error ? err.message : "Failed to load registrations.",
        }))
    : { rows: [] as AdminSaleRegistrationRow[], error: null as string | null };

  const expectedGuests =
    liveish && isSaleroomDeliveryMode(bundle.sale.deliveryMode)
      ? await getAdminExpectedGuests(saleId).catch(() => null)
      : null;

  return {
    saleId,
    sale: bundle.sale,
    liveish,
    rows: registrationsResult.rows,
    fetchError: registrationsResult.error,
    saleCurrency: bundle.lots[0]?.marketingDetails?.estimate?.currency ?? "GBP",
    expectedGuests,
  };
}
