import "server-only";

import {
  categoryDescendantsOf,
  categoryDirectChildrenOf,
} from "@/lib/admin/categories/category-taxonomy";
import { loadAdminCategoryDetail, loadAdminCategoryTree } from "@/lib/admin/load-category-detail";
import type { AdminDomainEventRow, AdminSaleListRow } from "@/lib/data/http/admin.server";
import {
  getAdminDomainEventsForAggregate,
  getAdminLotList,
  getAdminSalesList,
} from "@/lib/data/http/admin.server";
import { getAdminSubmissions } from "@/lib/data/http/submissions.server";
import type { AdminCategory, ItemSubmission, Lot } from "@auction/types";

export type CategoryOverviewPageModel = {
  category: AdminCategory;
  allCategories: AdminCategory[];
  directChildCount: number;
  descendantCount: number;
  previewLots: Lot[];
  previewSales: AdminSaleListRow[];
  previewSubmissions: ItemSubmission[];
  activityEvents: AdminDomainEventRow[];
};

/** Data/composition boundary for `/admin/categories/[id]` overview tab. */
export async function loadAdminCategoryOverviewPage(
  categoryId: string,
): Promise<CategoryOverviewPageModel> {
  const [category, allCategories, previewLots, previewSales, previewSubmissions, activityEvents] =
    await Promise.all([
      loadAdminCategoryDetail(categoryId),
      loadAdminCategoryTree(),
      getAdminLotList({ categoryId, limit: 3 }).catch(() => []),
      getAdminSalesList({ categoryId, limit: 3 }).catch(() => []),
      getAdminSubmissions({ categoryId, limit: 3 }).catch(() => ({ rows: [], total: 0 })),
      getAdminDomainEventsForAggregate({
        aggregateType: "category",
        aggregateId: categoryId,
        limit: 5,
      }).catch(() => []),
    ]);

  return {
    category,
    allCategories,
    directChildCount: categoryDirectChildrenOf(categoryId, allCategories).length,
    descendantCount: categoryDescendantsOf(categoryId, allCategories).length,
    previewLots,
    previewSales,
    previewSubmissions: previewSubmissions.rows,
    activityEvents,
  };
}
