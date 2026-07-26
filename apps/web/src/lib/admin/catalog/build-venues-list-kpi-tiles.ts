import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import type { KpiRowTile } from "@/lib/admin/kpi-row-tile.types";

type Input = {
  countOnPage: number;
  total: number;
  includeArchived: boolean;
  periodDays?: AdminKpiPeriodDays;
};

/** Venues list KPI band — snapshot tiles until a summary endpoint exists. */
export function buildVenuesListKpiTiles({
  countOnPage,
  total,
  includeArchived,
  periodDays = 30,
}: Input): KpiRowTile[] {
  return [
    buildSnapshotKpiTile("On this page", countOnPage, periodDays, {
      compareHint: `${total} matching`,
      trendTone: "secondary",
    }),
    buildSnapshotKpiTile("Matching venues", total, periodDays, {
      compareHint: includeArchived ? "Including archived" : "Active lens",
      trendTone: "info",
    }),
  ];
}
