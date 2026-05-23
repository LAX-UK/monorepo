import type { CatalogDetailSummaryItem } from "@/components/admin/catalog";
import {
  categoryDetailTabHref,
  categorySubmissionsHref,
} from "@/components/admin/category-detail/category-detail-types";
import type { AdminCategory } from "@auction/types";

export function buildCategorySummaryItems(
  categoryId: string,
  category: AdminCategory,
  directChildCount: number,
  descendantCount: number,
): CatalogDetailSummaryItem[] {
  return [
    {
      id: "children",
      label: "Direct children",
      value: directChildCount,
      hint:
        descendantCount > directChildCount ? `${descendantCount} descendants` : "Immediate branch",
      href: categoryDetailTabHref(categoryId, "children"),
    },
    {
      id: "lots",
      label: "Lots",
      value: category.usage.lots,
      hint: category.usage.lots === 0 ? "No lots" : "View lots",
      href: categoryDetailTabHref(categoryId, "lots"),
    },
    {
      id: "sales",
      label: "Sales",
      value: category.usage.sales,
      hint: category.usage.sales === 0 ? "No sales" : "View sales",
      href: categoryDetailTabHref(categoryId, "sales"),
    },
    {
      id: "submissions",
      label: "Submissions",
      value: category.usage.submissions,
      hint: category.usage.submissions === 0 ? "No submissions" : "View queue",
      href: categorySubmissionsHref(categoryId),
    },
    {
      id: "status",
      label: "Status",
      value: category.archived ? "Archived" : "Active",
      hint: category.parentId ? "Has parent" : "Root category",
    },
  ];
}
