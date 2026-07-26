import "server-only";

import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import type { Lot, Sale } from "@auction/types";

export type SaleSchedulePageModel = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
};

/** Data/composition boundary for `/admin/sales/[id]/schedule`. */
export async function loadAdminSaleSchedulePage(saleId: string): Promise<SaleSchedulePageModel> {
  const { sale, lots } = await loadAdminSaleDetail(saleId);
  return { saleId, sale, lots };
}
