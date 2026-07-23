import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import type { AdminArtistStats } from "@auction/types";

type Input = {
  stats: AdminArtistStats;
  periodDays: AdminKpiPeriodDays;
};

/** Figma-aligned 6-tile artists list KPI band — snapshot sparklines (no trend API). */
export function buildArtistsListKpiTiles({ stats, periodDays }: Input): KpiRowTile[] {
  return [
    buildSnapshotKpiTile("Total", stats.total, periodDays, {
      compareHint: "Canonical profiles",
      trendTone: "secondary",
    }),
    buildSnapshotKpiTile("Pending review", stats.pendingReview, periodDays, {
      compareHint: "Awaiting staff review",
      semanticTone: stats.pendingReview > 0 ? "warning" : "default",
      trendTone: "lot-orange",
    }),
    buildSnapshotKpiTile("Maker–sellers", stats.makerSellers, periodDays, {
      compareHint: "Linked seller profiles",
      trendTone: "info",
    }),
    buildSnapshotKpiTile("Historical", stats.historical, periodDays, {
      compareHint: "Historical artists",
      trendTone: "muted",
    }),
    buildSnapshotKpiTile("Brands", stats.brands, periodDays, {
      compareHint: "Brand profiles",
      trendTone: "accent-gold",
    }),
    buildSnapshotKpiTile("Featured", stats.featured, periodDays, {
      compareHint: "Featured on site",
      trendTone: "success",
    }),
  ];
}
