import type { NavGroup, NavItem } from "@/lib/navigation/nav-types";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  Gavel,
  LayoutDashboard,
  Plug,
  Users,
  Wallet,
} from "lucide-react";

export function getAdminNavGroups(pendingSubmissionCount: number): readonly NavGroup[] {
  const submissions: NavItem =
    pendingSubmissionCount > 0
      ? {
          href: "/admin/submissions",
          label: "Submissions",
          icon: ClipboardList,
          badge: pendingSubmissionCount,
        }
      : { href: "/admin/submissions", label: "Submissions", icon: ClipboardList };

  return [
    {
      title: "Operations",
      items: [
        { href: "/admin", label: "Overview", icon: LayoutDashboard },
        { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      ],
    },
    {
      title: "Catalog",
      items: [
        { href: "/admin/sales", label: "Sales", icon: Calendar },
        submissions,
        { href: "/admin/lots", label: "Lots", icon: Gavel },
      ],
    },
    {
      title: "Community",
      items: [
        { href: "/admin/payments", label: "Payments", icon: Wallet },
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/integrations/xero", label: "Xero", icon: Plug },
      ],
    },
  ] as const;
}
