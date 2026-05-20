import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { buildTrendKpiTile } from "@/lib/admin/build-trend-kpi-tile";
import type { AdminHomeKpiTrends } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminTodayMetricsPayload } from "@/lib/data/http/admin.server";
type Props = {
  periodDays: AdminKpiPeriodDays;
  metrics: AdminTodayMetricsPayload;
  trends: AdminHomeKpiTrends;
  bidsPerMinute: number;
};

export function TrendKpiBandWidget({ periodDays, metrics, trends, bidsPerMinute }: Props) {
  const tiles = [
    buildTrendKpiTile("Live lots", trends.lots, periodDays, {
      formatValue: () => String(metrics.liveLots),
      emphasize: true,
      trendTone: "primary",
    }),
    buildTrendKpiTile("New lots", trends.lots, periodDays, { trendTone: "secondary" }),
    buildTrendKpiTile("Payments", trends.payments, periodDays, {
      trendTone: "primary",
    }),
    buildTrendKpiTile("Stale payments", trends.payments, periodDays, {
      formatValue: () => String(metrics.stalePendingPayments),
      higherIsBetter: false,
      trendTone: "live-red",
      semanticTone: metrics.stalePendingPayments > 0 ? "warning" : "default",
    }),
    {
      label: "Revenue today",
      value: metrics.revenueToday,
      deltaDirection: "flat" as const,
      deltaPercent: "—",
      deltaTone: "neutral" as const,
      compareHint: "Captured UTC",
      trend: trends.payments.dailyCounts.length
        ? trends.payments.dailyCounts.map((n) => n / Math.max(...trends.payments.dailyCounts, 1))
        : [],
      trendTone: "primary" as const,
    },
    {
      label: "Bids/min",
      value: String(bidsPerMinute),
      deltaDirection: "flat" as const,
      deltaPercent: "—",
      deltaTone: "neutral" as const,
      compareHint: `${metrics.endingWithinHour} ending < 1h`,
      trend: [],
      trendTone: "lot-orange" as const,
    },
  ];

  return <AdminTrendKpiBand ariaLabel="Operations trends" tiles={tiles} />;
}
