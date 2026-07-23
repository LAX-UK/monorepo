import { isSaleLiveish } from "@/lib/admin/sales/sale-detail-helpers";
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
  getAdminSaleRegistrations(saleId),
);

/** Registration count for sale detail shell (null when sale is not liveish). */
export const loadAdminSaleRegistrationCount = cache(
  async (saleId: string, sale: Sale): Promise<number | null> => {
    if (!isSaleLiveish(sale)) return null;
    try {
      const registrations = await loadAdminSaleRegistrations(saleId);
      return registrations.length;
    } catch {
      return null;
    }
  },
);

/** Pending registration count for readiness checks and attention badges. */
export const loadAdminSalePendingRegistrationCount = cache(
  async (saleId: string, sale: Sale): Promise<number | null> => {
    if (!isSaleLiveish(sale)) return null;
    try {
      const registrations = await loadAdminSaleRegistrations(saleId);
      return registrations.filter((registration) => registration.status === "pending").length;
    } catch {
      return null;
    }
  },
);
