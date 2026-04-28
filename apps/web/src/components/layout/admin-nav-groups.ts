import type { NavGroup, NavItem } from "@/lib/navigation/nav-types";
import type { UserRole } from "@auction/types";
import { canAccessPlatformAdminRoutes } from "@auction/types";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  Gavel,
  LayoutDashboard,
  MailPlus,
  Plug,
  Users,
  Wallet,
} from "lucide-react";

export function getAdminNavGroups(role: UserRole, pendingSubmissionCount: number): readonly NavGroup[] {
  const financeOnly: readonly NavGroup[] = [
    {
      title: "Finance",
      items: [
        { href: "/admin/payments", label: "Payments", icon: Wallet },
        { href: "/admin/integrations/xero", label: "Xero", icon: Plug },
      ],
    },
  ];

  if (!canAccessPlatformAdminRoutes(role)) {
    return financeOnly;
  }

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
        { href: "/admin/invitations", label: "Invitations", icon: MailPlus },
      ],
    },
  ] as const;
}
