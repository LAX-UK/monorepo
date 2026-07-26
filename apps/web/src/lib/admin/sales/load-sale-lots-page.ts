import "server-only";

import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import type { CategoryNode, Lot, Sale } from "@auction/types";

export type SaleLotsPageModel = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  canAddLots: boolean;
  categories: CategoryNode[];
};

/** Data/composition boundary for `/admin/sales/[id]/lots`. */
export async function loadAdminSaleLotsPage(saleId: string): Promise<SaleLotsPageModel> {
  const bundle = await loadAdminSaleDetail(saleId);
  const { sale, lots } = bundle;
  const canAddLots =
    sale.status === "draft" || sale.status === "scheduled" || sale.status === "active";
  const categories =
    canAddLots && sale.status !== "draft"
      ? await (await getServerCategoryReader()).tree().catch(() => [])
      : [];

  return {
    saleId,
    sale,
    lots,
    canAddLots,
    categories,
  };
}
