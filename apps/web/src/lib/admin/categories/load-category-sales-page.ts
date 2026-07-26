import "server-only";

import { loadAdminCategoryDetail } from "@/lib/admin/load-category-detail";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { getAdminSalesList } from "@/lib/data/http/admin.server";

export type CategorySalesPageModel = {
  sales: AdminSaleListRow[];
  totalCount: number;
};

/** Data/composition boundary for `/admin/categories/[id]/sales`. */
export async function loadAdminCategorySalesPage(
  categoryId: string,
): Promise<CategorySalesPageModel> {
  const category = await loadAdminCategoryDetail(categoryId);
  const sales = await getAdminSalesList({ categoryId, limit: 50 }).catch(() => []);

  return { sales, totalCount: category.usage.sales };
}
