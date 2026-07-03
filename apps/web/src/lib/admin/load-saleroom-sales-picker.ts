import "server-only";

import { getAdminSalesList } from "@/lib/data/http/admin.server";
import type { SaleDeliveryMode } from "@auction/types";

export type SaleroomSalePickerOption = {
  id: string;
  title: string;
  deliveryMode: SaleDeliveryMode;
};

/** Onsite + hybrid sales eligible for event linking. */
export async function loadSaleroomSalesForPicker(): Promise<SaleroomSalePickerOption[]> {
  const [onsiteRows, hybridRows] = await Promise.all([
    getAdminSalesList({ deliveryMode: "onsite", limit: 50 }).catch(() => []),
    getAdminSalesList({ deliveryMode: "hybrid", limit: 50 }).catch(() => []),
  ]);
  const byId = new Map<string, SaleroomSalePickerOption>();
  for (const row of [...onsiteRows, ...hybridRows]) {
    byId.set(row.sale.id, {
      id: row.sale.id,
      title: row.sale.title,
      deliveryMode: row.sale.deliveryMode,
    });
  }
  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title));
}
