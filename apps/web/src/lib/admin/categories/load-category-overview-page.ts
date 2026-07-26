import "server-only";

import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { buildCategorySummaryItems } from "@/lib/admin/build-category-summary-items";
import { buildCategoryTaxonomyReadiness } from "@/lib/admin/catalog-readiness";
import {
  type CategoryOverviewViewModel,
  buildCategoryOverviewViewModel,
} from "@/lib/admin/categories/build-category-overview-vm";
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
  overview: CategoryOverviewViewModel;
};

/** Data/composition boundary for `/admin/categories/[id]` overview tab. */
export async function loadAdminCategoryOverviewPage(
  categoryId: string,
  periodDays: AdminKpiPeriodDays = 30,
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

  const directChildCount = categoryDirectChildrenOf(categoryId, allCategories).length;
  const descendantCount = categoryDescendantsOf(categoryId, allCategories).length;
  const summaryItems = buildCategorySummaryItems(
    categoryId,
    category,
    directChildCount,
    descendantCount,
  );
  const readiness = buildCategoryTaxonomyReadiness(categoryId, category, directChildCount);
  const overview = buildCategoryOverviewViewModel(
    categoryId,
    category,
    directChildCount,
    descendantCount,
    summaryItems,
    readiness,
    periodDays,
  );

  return {
    category,
    allCategories,
    directChildCount,
    descendantCount,
    previewLots,
    previewSales,
    previewSubmissions: previewSubmissions.rows,
    activityEvents,
    overview,
  };
}
