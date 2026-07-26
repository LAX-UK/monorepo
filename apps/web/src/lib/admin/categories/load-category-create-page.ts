import "server-only";

import { getAdminCategoryList } from "@/lib/data/http/admin.server";
import type { AdminCategory } from "@auction/types";

export type CategoryCreatePageModel = {
  allCategories: AdminCategory[];
  setupError: string | null;
};

/** Data/composition boundary for `/admin/categories/new`. */
export async function loadAdminCategoryCreatePage(): Promise<CategoryCreatePageModel> {
  try {
    const allCategories = await getAdminCategoryList({ includeArchived: true });
    return { allCategories, setupError: null };
  } catch {
    return {
      allCategories: [],
      setupError:
        "Could not load the category tree for parent selection. Refresh the page or check API connectivity before creating a category.",
    };
  }
}
