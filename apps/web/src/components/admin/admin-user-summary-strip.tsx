import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import type { AdminUserSummaryMetrics } from "@/lib/admin/admin-user-metrics";
import { daysSinceIso } from "@/lib/admin/relative-time";
import { formatMoney } from "@/lib/format-currency";

export type { AdminUserSummaryMetrics };

export function AdminUserSummaryStrip({ metrics }: { metrics: AdminUserSummaryMetrics }) {
  const memberDays = daysSinceIso(metrics.memberSinceIso);
  const spendLabel =
    metrics.lifetimeSpend != null && metrics.lifetimeSpend > 0
      ? formatMoney(metrics.lifetimeSpend.toFixed(2))
      : "—";

  return (
    <KpiRow
      embedded
      columns={4}
      stripClassName="md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4"
      tiles={[
        {
          id: "spend",
          label: "Lifetime spend",
          value: spendLabel,
          href: "?tab=payments",
          clickable: metrics.lifetimeSpend != null && metrics.lifetimeSpend > 0,
        },
        {
          id: "won",
          label: "Lots won",
          value: metrics.lotsWon != null ? String(metrics.lotsWon) : "—",
          href: "?tab=won-lots",
          clickable: metrics.lotsWon != null && metrics.lotsWon > 0,
        },
        {
          id: "submissions",
          label: "Submissions",
          value: metrics.submissionsCount != null ? String(metrics.submissionsCount) : "—",
          href: "?tab=overview#legal-entities",
          clickable: metrics.submissionsCount != null && metrics.submissionsCount > 0,
        },
        {
          id: "member",
          label: "Member for",
          value: memberDays === 0 ? "Today" : `${memberDays}D`,
          delta: "Since signup",
        },
      ]}
    />
  );
}
