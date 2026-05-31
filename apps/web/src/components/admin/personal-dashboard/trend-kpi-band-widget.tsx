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
    {
      label: "Live lots",
      value: String(metrics.liveLots),
      deltaDirection: "flat" as const,
      deltaPercent: "—",
      deltaTone: "neutral" as const,
      compareHint: `${metrics.endingWithinHour} ending < 1h`,
      emphasize: true,
      trend: [],
      trendTone: "primary" as const,
    },
    buildTrendKpiTile("New lots", trends.lots, periodDays, { trendTone: "secondary" }),
    buildTrendKpiTile("Payments", trends.payments, periodDays, {
      trendTone: "primary",
    }),
    {
      label: "Stale payments",
      value: String(metrics.stalePendingPayments),
      deltaDirection: "flat" as const,
      deltaPercent: "—",
      deltaTone: "neutral" as const,
      compareHint: "Pending > 48h",
      trend: [],
      trendTone: "live-red" as const,
      semanticTone: metrics.stalePendingPayments > 0 ? ("warning" as const) : ("default" as const),
    },
    {
      label: "Revenue today",
      value: metrics.revenueToday,
      deltaDirection: "flat" as const,
      deltaPercent: "—",
      deltaTone: "neutral" as const,
      compareHint: "Captured UTC",
      trend: [],
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
