import type { LotLensId } from "@/lib/admin/catalog/lots-lenses";
import type { CatalogSegmentItem } from "@/lib/admin/catalog/types";
import type { AdminLotsLensCounts } from "@/lib/data/http/admin-lots-summary.server";

/** Attach aggregate lens tab badges from admin lots summary counts. */
export function applyLotsLensBadges(
  lenses: readonly CatalogSegmentItem[],
  counts: AdminLotsLensCounts,
): CatalogSegmentItem[] {
  return lenses.map((lens) => {
    const count = counts[lens.id as LotLensId];
    return {
      ...lens,
      ...(count != null && count > 0 ? { badge: count } : {}),
    };
  });
}
