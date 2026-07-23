import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import { buildTrendKpiTile } from "@/lib/admin/build-trend-kpi-tile";
import type { AdminKpiTrendBundle } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminPayoutListSummary } from "@/lib/data/http/admin-payouts.shared";
import { formatMoney } from "@/lib/ui/format";

export function buildPayoutsListKpiTiles(input: {
  summary: AdminPayoutListSummary;
  trend: AdminKpiTrendBundle;
  periodDays: AdminKpiPeriodDays;
}): KpiRowTile[] {
  const { summary, trend, periodDays } = input;
  return [
    buildTrendKpiTile("Payout events", trend, periodDays, {
      emphasize: true,
      trendTone: "primary",
    }),
    buildSnapshotKpiTile("Scheduled", summary.scheduled, periodDays, {
      compareHint: "Across matching payouts",
      trendTone: "info",
    }),
    buildSnapshotKpiTile("In transit", summary.inTransit, periodDays, {
      compareHint: "Across matching payouts",
      trendTone: "accent-gold",
    }),
    buildSnapshotKpiTile("Visible net", Number.parseFloat(summary.totalNet) || 0, periodDays, {
      compareHint: `${summary.paid} paid`,
      emphasize: true,
      trendTone: "success",
    }),
    buildSnapshotKpiTile(
      "Failed / clawback",
      summary.failed + summary.clawbackPending,
      periodDays,
      {
        compareHint: "Needs attention",
        semanticTone: summary.failed + summary.clawbackPending > 0 ? "warning" : "default",
        trendTone: "live-red",
      },
    ),
    buildSnapshotKpiTile("Blockers", summary.readiness.blockerPayoutCount, periodDays, {
      compareHint: "Settlement issues",
      semanticTone: summary.readiness.blockerPayoutCount > 0 ? "danger" : "default",
      trendTone: "live-red",
    }),
  ].map((tile, index) =>
    index === 0 || index === 1 || index === 2 || index === 5
      ? tile
      : { ...tile, value: formatMoney(String(tile.value), "GBP") },
  );
}

export function buildPayoutsMobileMetrics(summary: AdminPayoutListSummary) {
  return [
    { id: "scheduled", label: "Scheduled", value: String(summary.scheduled) },
    { id: "transit", label: "In transit", value: String(summary.inTransit) },
    {
      id: "net",
      label: "Visible net",
      value: formatMoney(summary.totalNet, "GBP"),
    },
  ];
}
