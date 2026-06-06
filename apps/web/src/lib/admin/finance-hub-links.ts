import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";

export const FINANCE_HUB_QUICK_LINKS = [
  { href: "/admin/payments", label: "Payments" },
  {
    href: "/admin/payments?manualReview=1",
    label: "Manual review",
    countKey: "manualReviewCount" as const,
  },
  { href: "/admin/disputes", label: "Disputes", countKey: "disputesOpen" as const },
  { href: "/admin/payouts", label: "Payouts", countKey: "payoutsFailed" as const },
  { href: "/admin/payouts/settlement", label: "Run settlement" },
  { href: "/admin/integrations/xero", label: "Xero integration" },
] as const;

export function mapFinanceHubQuickLinks(navCounts: AdminNavCounts) {
  return FINANCE_HUB_QUICK_LINKS.map((item) => {
    const count = "countKey" in item && item.countKey ? navCounts[item.countKey] : undefined;
    return count != null && count > 0
      ? { href: item.href, label: item.label, count }
      : { href: item.href, label: item.label };
  });
}
