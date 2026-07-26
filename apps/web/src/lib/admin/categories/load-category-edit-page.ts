import "server-only";

import { categoryDetailTabHref } from "@/lib/admin/categories/category-detail-routes";
import { loadAdminCategoryDetail } from "@/lib/admin/load-category-detail";
import { getAdminCategoryList } from "@/lib/data/http/admin.server";
import type { AdminCategory } from "@auction/types";

export type CategoryEditPageModel = {
  categoryId: string;
  category: AdminCategory;
  allCategories: AdminCategory[];
  overviewHref: string;
};

/** Data/composition boundary for `/admin/categories/[id]/edit`. */
export async function loadAdminCategoryEditPage(
  categoryId: string,
): Promise<CategoryEditPageModel> {
  const [category, allCategories] = await Promise.all([
    loadAdminCategoryDetail(categoryId),
    getAdminCategoryList({ includeArchived: true }),
  ]);

  return {
    categoryId,
    category,
    allCategories,
    overviewHref: categoryDetailTabHref(categoryId, "overview"),
  };
}
