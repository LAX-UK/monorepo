import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import type { AdminCategoriesListSummary } from "@auction/types";

type Input = {
  onPageCount: number;
  includeArchived: boolean;
  periodDays: AdminKpiPeriodDays;
  summary: AdminCategoriesListSummary;
};

/** Figma-aligned 6-tile categories list KPI band — snapshot sparklines. */
export function buildCategoriesListKpiTiles({
  onPageCount,
  includeArchived,
  periodDays,
  summary,
}: Input): KpiRowTile[] {
  const lensLabel = includeArchived ? "Archived" : "Active";
  const lensTile = buildSnapshotKpiTile("Lens", includeArchived ? 1 : 0, periodDays, {
    compareHint: "Current view",
    trendTone: "success",
  });

  return [
    buildSnapshotKpiTile("On this page", onPageCount, periodDays, {
      compareHint: `${summary.totalCount} matching`,
      trendTone: "secondary",
    }),
    buildSnapshotKpiTile("Matching categories", summary.totalCount, periodDays, {
      compareHint: lensLabel,
      trendTone: "info",
    }),
    buildSnapshotKpiTile("Linked lots", summary.usageTotals.lots, periodDays, {
      compareHint: "Across matching categories",
      trendTone: "accent-gold",
    }),
    buildSnapshotKpiTile("Linked sales", summary.usageTotals.sales, periodDays, {
      compareHint: "Across matching categories",
      trendTone: "muted",
    }),
    buildSnapshotKpiTile("Linked submissions", summary.usageTotals.submissions, periodDays, {
      compareHint: "Across matching categories",
      trendTone: "lot-orange",
    }),
    { ...lensTile, value: lensLabel },
  ];
}
