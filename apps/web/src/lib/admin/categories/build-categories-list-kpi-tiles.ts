import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import type { KpiRowTile } from "@/lib/admin/kpi-row-tile.types";
import type { AdminCategoriesListSummary } from "@auction/types";

type Input = {
  periodDays: AdminKpiPeriodDays;
  summary: AdminCategoriesListSummary;
};

/** Three-tile categories list KPI band aligned with Figma. */
export function buildCategoriesListKpiTiles({ periodDays, summary }: Input): KpiRowTile[] {
  const { lots, sales, submissions } = summary.usageTotals;
  const totalAssignments = lots + sales + submissions;
  const most = summary.mostUsedCategory;

  const mostUsedTile = buildSnapshotKpiTile(
    "Most used category",
    most?.usage.total ?? 0,
    periodDays,
    {
      compareHint: most
        ? `${most.usage.lots} lots · ${most.usage.sales} sales`
        : "No assignments yet",
      trendTone: "accent-gold",
    },
  );

  return [
    buildSnapshotKpiTile("Active categories", summary.activeCount, periodDays, {
      compareHint: "Visible across the platform",
      trendTone: "success",
    }),
    buildSnapshotKpiTile("Total assignments", totalAssignments, periodDays, {
      compareHint: "Across lots, submissions & sales",
      trendTone: "info",
    }),
    {
      ...mostUsedTile,
      value: most?.name ?? "—",
    },
  ];
}
