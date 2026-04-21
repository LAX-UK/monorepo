import type { NavGroup, NavItem } from "@/lib/navigation/nav-types";

export function getAdminNavGroups(pendingSubmissionCount: number): readonly NavGroup[] {
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
    {
      title: "Operations",
      items: [
        { href: "/admin", label: "Overview", icon: "dashboard" },
        { href: "/admin/analytics", label: "Analytics", icon: "bar_chart" },
      ],
    },
    {
      title: "Catalog",
      items: [
        { href: "/admin/sales", label: "Sales", icon: "event" },
        submissions,
        { href: "/admin/lots", label: "Lots", icon: "gavel" },
      ],
    },
    {
      title: "Community",
      items: [
        { href: "/admin/payments", label: "Payments", icon: "account_balance_wallet" },
        { href: "/admin/users", label: "Users", icon: "group" },
      ],
    },
  ] as const;
}
