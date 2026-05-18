import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import type { PortfolioAnalyticsVm } from "@/lib/data/view-models/dashboard-portfolio.vm";

type Props = {
  analytics: PortfolioAnalyticsVm;
};

/** @deprecated Prefer `KpiRow` directly — thin wrapper for portfolio summary. */
export function PortfolioAnalyticsCard({ analytics }: Props) {
  if (analytics.totalRows === 0) return null;
  return (
    <KpiRow
      variant="hero"
      columns={4}
      className="xl:grid-cols-3"
      aria-label="Collection summary"
      tiles={[
        {
          id: "spent",
          label: "Total spent",
          value: analytics.totalSpentFormatted,
          semanticTone: "emphasis",
        },
        {
          id: "outstanding",
          label: "Outstanding",
          value: analytics.outstandingFormatted,
          semanticTone: analytics.hasOutstanding ? "warning" : "default",
        },
        {
          id: "year",
          label: "This year",
          value: String(analytics.wonThisYear),
        },
      ]}
    />
  );
}
