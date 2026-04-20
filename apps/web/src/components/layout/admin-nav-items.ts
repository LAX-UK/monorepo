import type { NavItem } from "@/lib/navigation/nav-types";

export function getAdminNavItems(pendingSubmissionCount: number): readonly NavItem[] {
  const submissions: NavItem =
    pendingSubmissionCount > 0
      ? {
          href: "/admin/submissions",
          label: "Submissions",
          icon: "assignment",
          badge: pendingSubmissionCount,
        }
      : { href: "/admin/submissions", label: "Submissions", icon: "assignment" };
  return [
    { href: "/admin", label: "Overview", icon: "dashboard" },
    { href: "/admin/analytics", label: "Analytics", icon: "bar_chart" },
    { href: "/admin/sales", label: "Sales", icon: "event" },
    submissions,
    { href: "/admin/lots", label: "Lots", icon: "gavel" },
    { href: "/admin/payments", label: "Payments", icon: "account_balance_wallet" },
    { href: "/admin/users", label: "Users", icon: "group" },
  ];
}
