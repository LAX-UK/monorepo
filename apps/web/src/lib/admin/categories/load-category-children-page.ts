import "server-only";

import { loadAdminCategoryDetail } from "@/lib/admin/load-category-detail";
import { getAdminCategoryList } from "@/lib/data/http/admin.server";
import type { AdminCategory } from "@auction/types";

export type CategoryChildrenPageModel = {
  categoryId: string;
  allCategories: AdminCategory[];
};

/** Data/composition boundary for `/admin/categories/[id]/children`. */
export async function loadAdminCategoryChildrenPage(
  categoryId: string,
): Promise<CategoryChildrenPageModel> {
  await loadAdminCategoryDetail(categoryId);
  const allCategories = await getAdminCategoryList({ includeArchived: true });

  return { categoryId, allCategories };
}
