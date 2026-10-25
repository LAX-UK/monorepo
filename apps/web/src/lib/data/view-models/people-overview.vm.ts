import type { AdminUserSummaryMetrics } from "@/lib/admin/admin-user-metrics";
import type { AdminPaymentRow } from "@/lib/data/http/admin.server";
import { sumOutstandingPayments } from "@/lib/data/view-models/client-commerce-tab.vm";
import { formatMoney } from "@/lib/format-currency";
import type { StatItem } from "@auction/staff-ui";

type BuildClientOverviewInput = {
  summaryMetrics: AdminUserSummaryMetrics;
  payments?: readonly AdminPaymentRow[];
};

function count(value: number | null): string {
  return value != null ? String(value) : "—";
}

/** The four headline numbers at the top of a client's overview. */
export function buildClientOverviewStats(input: BuildClientOverviewInput): StatItem[] {
  const { summaryMetrics, payments = [] } = input;
  const outstanding = sumOutstandingPayments(payments);

  return [
    {
      id: "lifetime",
      label: "Lifetime spend",
      value: summaryMetrics.lifetimeSpend
        ? formatMoney(summaryMetrics.lifetimeSpend.toFixed(2))
        : "—",
      hint: "Captured payments",
    },
    {
      id: "outstanding",
      label: "Outstanding",
      value: outstanding > 0 ? formatMoney(outstanding.toFixed(2)) : "—",
      hint: outstanding > 0 ? "Payment due" : "Nothing due",
      ...(outstanding > 0 ? { hintTone: "negative" as const } : {}),
    },
    { id: "won", label: "Lots won", value: count(summaryMetrics.lotsWon) },
    { id: "submissions", label: "Submissions", value: count(summaryMetrics.submissionsCount) },
  ];
}
