import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import { daysSinceIso } from "@/lib/admin/relative-time";
import { formatMoney } from "@/lib/format-currency";

export type AdminUserSummaryMetrics = {
  lifetimeSpend: number | null;
  lotsWon: number | null;
  submissionsCount: number | null;
  memberSinceIso: string;
};

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
      className="mt-2"
      tiles={[
        { id: "spend", label: "Lifetime spend", value: spendLabel },
        {
          id: "won",
          label: "Lots won",
          value: metrics.lotsWon != null ? String(metrics.lotsWon) : "—",
        },
        {
          id: "submissions",
          label: "Submissions",
          value: metrics.submissionsCount != null ? String(metrics.submissionsCount) : "—",
        },
        {
          id: "member",
          label: "Member for",
          value: memberDays === 0 ? "Today" : `${memberDays}d`,
          delta: "Since signup",
        },
      ]}
    />
  );
}
