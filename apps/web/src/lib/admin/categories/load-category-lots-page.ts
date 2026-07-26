import "server-only";

import { loadAdminCategoryDetail } from "@/lib/admin/load-category-detail";
import { getAdminLotList } from "@/lib/data/http/admin.server";
import type { Lot } from "@auction/types";

export type CategoryLotsPageModel = {
  lots: Lot[];
  totalCount: number;
};

/** Data/composition boundary for `/admin/categories/[id]/lots`. */
export async function loadAdminCategoryLotsPage(
  categoryId: string,
): Promise<CategoryLotsPageModel> {
  const category = await loadAdminCategoryDetail(categoryId);
  const lots = await getAdminLotList({ categoryId, limit: 50 }).catch(() => []);

  return { lots, totalCount: category.usage.lots };
}
