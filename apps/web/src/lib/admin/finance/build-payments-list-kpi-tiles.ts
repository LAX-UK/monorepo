import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import { buildTrendKpiTile } from "@/lib/admin/build-trend-kpi-tile";
import type { AdminKpiTrendBundle } from "@/lib/data/http/admin-kpi-trends.server";
import { formatCompactMoney } from "@/lib/ui/format";

type PaymentsSummary = {
  totalVolume: number;
  captured: number;
  pending: number;
  refunded: number;
};

export function buildPaymentsListKpiTiles(input: {
  summary: PaymentsSummary;
  trend: AdminKpiTrendBundle;
  periodDays: AdminKpiPeriodDays;
}): KpiRowTile[] {
  const { summary, trend, periodDays } = input;
  return [
    buildSnapshotKpiTile("Total volume", summary.totalVolume, periodDays, {
      compareHint: "Matching payments",
      emphasize: true,
      trendTone: "primary",
    }),
    buildTrendKpiTile("Payment events", trend, periodDays, {
      trendTone: "primary",
    }),
    buildSnapshotKpiTile("Awaiting action", summary.pending, periodDays, {
      compareHint: "Pending + authorized",
      semanticTone: summary.pending > 0 ? "warning" : "default",
      trendTone: "live-red",
    }),
    buildSnapshotKpiTile("Settled", summary.captured, periodDays, {
      compareHint: "Captured",
      trendTone: "success",
    }),
    buildSnapshotKpiTile("Refunded", summary.refunded, periodDays, {
      compareHint: "Matching payments",
      trendTone: "muted",
    }),
  ].map((tile, index) =>
    index === 1 ? tile : { ...tile, value: formatCompactMoney(Number(tile.value)) },
  );
}

export function buildManualReviewKpiTiles(input: {
  total: number;
  financeHolds: number;
  complianceHolds: number;
}): KpiRowTile[] {
  return [
    buildSnapshotKpiTile("Total holds", input.total, 30, {
      compareHint: "Current queue",
      trendTone: "secondary",
    }),
    buildSnapshotKpiTile("Finance holds", input.financeHolds, 30, {
      compareHint: "Finance review",
      semanticTone: input.financeHolds > 0 ? "warning" : "default",
      trendTone: "accent-gold",
    }),
    buildSnapshotKpiTile("Compliance holds", input.complianceHolds, 30, {
      compareHint: "Compliance review",
      semanticTone: input.complianceHolds > 0 ? "danger" : "default",
      trendTone: "live-red",
    }),
  ];
}
