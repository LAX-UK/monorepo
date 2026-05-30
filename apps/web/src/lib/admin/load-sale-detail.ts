import { isSaleLiveish } from "@/components/admin/sale-detail/sale-detail-helpers";
import {
  type AdminSaleListRow,
  getAdminSaleById,
  getAdminSaleRegistrations,
} from "@/lib/data/http/admin.server";
import type { Sale } from "@auction/types";
import { notFound } from "next/navigation";
import { cache } from "react";

/** Deduped sale bundle fetch for layout + tab routes. */
export const loadAdminSaleDetail = cache(async (saleId: string): Promise<AdminSaleListRow> => {
  const bundle = await getAdminSaleById(saleId);
  if (!bundle) notFound();
  return bundle;
});

/** Cached registrations list for layout count + registrations tab. */
export const loadAdminSaleRegistrations = cache(async (saleId: string) =>
  getAdminSaleRegistrations(saleId).catch(() => []),
);

/** Registration count for sale detail shell (null when sale is not liveish). */
export const loadAdminSaleRegistrationCount = cache(
  async (saleId: string, sale: Sale): Promise<number | null> => {
    if (!isSaleLiveish(sale)) return null;
    const registrations = await loadAdminSaleRegistrations(saleId);
    return registrations.length;
  },
);
