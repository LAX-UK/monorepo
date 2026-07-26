import "server-only";

import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import type { Sale } from "@auction/types";

export type SalePressPageModel = {
  saleId: string;
  initialPressCoverage: NonNullable<Sale["pressCoverage"]>;
};

/** Data/composition boundary for `/admin/sales/[id]/press`. */
export async function loadAdminSalePressPage(saleId: string): Promise<SalePressPageModel> {
  const bundle = await loadAdminSaleDetail(saleId);
  return {
    saleId,
    initialPressCoverage: bundle.sale.pressCoverage ?? [],
  };
}
