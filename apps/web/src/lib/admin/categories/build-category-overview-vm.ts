import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { applyFlatKpiTrendOverlay } from "@/lib/admin/apply-flat-kpi-trend-overlay";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import type { CatalogDetailSummaryItem } from "@/lib/admin/catalog/types";
import type { DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import type { AdminCategory } from "@auction/types";

export type CategoryOverviewViewModel = {
  summaryItems: readonly CatalogDetailSummaryItem[];
  readiness: CatalogReadinessResult;
  kpiTiles: readonly DetailBoardKpiTile[];
};

function withFlatKpiOverlay(
  tile: DetailBoardKpiTile,
  snapshot: number,
  periodDays: AdminKpiPeriodDays,
): DetailBoardKpiTile {
  return { ...tile, ...applyFlatKpiTrendOverlay(snapshot, periodDays) };
}

export function buildCategoryOverviewViewModel(
  _categoryId: string,
  category: AdminCategory,
  directChildCount: number,
  descendantCount: number,
  summaryItems: readonly CatalogDetailSummaryItem[],
  readiness: CatalogReadinessResult,
  periodDays: AdminKpiPeriodDays = 30,
): CategoryOverviewViewModel {
  return {
    summaryItems,
    readiness,
    kpiTiles: [
      withFlatKpiOverlay(
        {
          id: "children",
          label: "Direct children",
          value: String(directChildCount),
          trendTone: "info",
        },
        directChildCount,
        periodDays,
      ),
      withFlatKpiOverlay(
        {
          id: "descendants",
          label: "Descendants",
          value: String(descendantCount),
          trendTone: "secondary",
        },
        descendantCount,
        periodDays,
      ),
      withFlatKpiOverlay(
        {
          id: "lots",
          label: "Lots",
          value: String(category.usage.lots),
          trendTone: "accent-gold",
        },
        category.usage.lots,
        periodDays,
      ),
      withFlatKpiOverlay(
        {
          id: "sales",
          label: "Sales",
          value: String(category.usage.sales),
          trendTone: "muted",
        },
        category.usage.sales,
        periodDays,
      ),
      withFlatKpiOverlay(
        {
          id: "submissions",
          label: "Submissions",
          value: String(category.usage.submissions),
          trendTone: "lot-orange",
        },
        category.usage.submissions,
        periodDays,
      ),
    ],
  };
}
