import type { SaleLensId } from "@/lib/admin/catalog/sales-lenses";
import type { CatalogSegmentItem } from "@/lib/admin/catalog/types";
import type { AdminSalesLensCounts } from "@/lib/data/http/admin-sales-summary.server";

/** Attach aggregate lens tab badges from admin sales summary counts. */
export function applySalesLensBadges(
  lenses: readonly CatalogSegmentItem[],
  counts: AdminSalesLensCounts,
): CatalogSegmentItem[] {
  return lenses.map((lens) => {
    const count = counts[lens.id as SaleLensId];
    return {
      ...lens,
      ...(count != null && count > 0 ? { badge: count } : {}),
    };
  });
}
