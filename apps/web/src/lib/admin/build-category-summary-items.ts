import type { CatalogDetailSummaryItem } from "@/lib/admin/catalog/types";
import {
  categoryDetailTabHref,
  categorySubmissionsHref,
} from "@/lib/admin/categories/category-detail-routes";
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
      hint: category.usage.submissions === 0 ? "No submissions" : "View submissions",
      href: categorySubmissionsHref(categoryId),
    },
    {
      id: "status",
      label: "Status",
      value: "",
      status: { domain: "category", status: category.archived ? "archived" : "active" },
      hint: category.parentId ? "Has parent" : "Root category",
    },
  ];
}
