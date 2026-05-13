import type { NavGroup, NavItem } from "@/lib/navigation/nav-types";
import {
  AUDIT_ACCESS,
  CMS_ACCESS,
  CONDITION_REPORTS_ACCESS,
  EMAIL_OUTBOX_ACCESS,
  STAFF_OVERVIEW_ACCESS,
  SUBMISSIONS_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import type { UserRole, UserStaffRole } from "@auction/types";
import { userHasAccessTo } from "@auction/types";
import {
  BarChart3,
  Brush,
  Calendar,
  ClipboardList,
  FileText,
  Gavel,
  LayoutDashboard,
  LayoutGrid,
  ListTree,
  Mail,
  MailPlus,
  MonitorPlay,
  MonitorSmartphone,
  Plug,
  ScrollText,
  Settings,
  ShieldAlert,
  Truck,
  Users,
  Wallet,
  WalletCards,
  Workflow,
} from "lucide-react";

function filterNavItems(
  role: UserRole,
  staffRole: UserStaffRole | null | undefined,
  items: readonly NavItem[],
): NavItem[] {
  return items.filter((item) => {
    if (item.requirement == null) return true;
    return userHasAccessTo(role, staffRole ?? null, item.requirement);
  });
}

function filterGroups(
  role: UserRole,
  staffRole: UserStaffRole | null | undefined,
  groups: readonly NavGroup[],
): NavGroup[] {
  return groups
    .map((g) => ({ ...g, items: filterNavItems(role, staffRole, g.items) }))
    .filter((g) => g.items.length > 0);
}

export function getAdminNavGroups(
  role: UserRole,
  pendingSubmissionCount: number,
  staffRole?: UserStaffRole | null,
): readonly NavGroup[] {
  const submissions: NavItem =
    pendingSubmissionCount > 0
      ? {
          href: "/admin/submissions",
          label: "Submissions",
          icon: ClipboardList,
          badge: pendingSubmissionCount,
          requirement: SUBMISSIONS_ACCESS,
        }
      : {
          href: "/admin/submissions",
          label: "Submissions",
          icon: ClipboardList,
          requirement: SUBMISSIONS_ACCESS,
        };

  const groups: readonly NavGroup[] = [
    {
      title: "Operations",
      items: [
        {
          href: "/admin",
          label: "Overview",
          icon: LayoutDashboard,
          requirement: STAFF_OVERVIEW_ACCESS,
        },
        {
          href: "/admin/analytics",
          label: "Analytics",
          icon: BarChart3,
          requirement: "platform.admin.full",
        },
        {
          href: "/admin/lot-fulfilment",
          label: "Lot fulfilment",
          icon: Truck,
          requirement: "operations.fulfilment",
        },
        {
          href: "/admin/conveyor",
          label: "Conveyor",
          icon: Workflow,
          requirement: "operations.fulfilment",
        },
        {
          href: "/admin/condition-reports",
          label: "Condition reports",
          icon: FileText,
          requirement: CONDITION_REPORTS_ACCESS,
        },
      ],
    },
    {
      title: "Catalog",
      items: [
        { href: "/admin/sales", label: "Sales", icon: Calendar, requirement: "auction.manage" },
        submissions,
        { href: "/admin/lots", label: "Lots", icon: Gavel, requirement: "catalogue.write" },
        {
          href: "/admin/categories",
          label: "Categories",
          icon: ListTree,
          requirement: "catalogue.write",
        },
        { href: "/admin/artists", label: "Artists", icon: Brush, requirement: "artist.read" },
        {
          href: "/admin/saleroom",
          label: "Saleroom",
          icon: MonitorPlay,
          requirement: "auction.manage",
        },
      ],
    },
    {
      title: "Finance",
      items: [
        {
          href: "/admin/payments",
          label: "Payments",
          icon: WalletCards,
          requirement: "finance.read",
        },
        {
          href: "/admin/disputes",
          label: "Disputes",
          icon: ShieldAlert,
          requirement: "finance.read",
        },
        {
          href: "/admin/payouts",
          label: "Payouts",
          icon: Wallet,
          requirement: "finance.read",
        },
        {
          href: "/admin/integrations/xero",
          label: "Xero",
          icon: Plug,
          requirement: "finance.read",
        },
      ],
    },
    {
      title: "Community & platform",
      items: [
        { href: "/admin/users", label: "Users", icon: Users, requirement: "platform.admin.full" },
        {
          href: "/admin/impersonation",
          label: "Impersonate",
          icon: MonitorSmartphone,
          requirement: "platform.admin.full",
        },
        {
          href: "/admin/legal-entities",
          label: "Legal entities",
          icon: ScrollText,
          requirement: "legal_entity.read",
        },
        {
          href: "/admin/invitations",
          label: "Invitations",
          icon: MailPlus,
          requirement: "platform.admin.full",
        },
        {
          href: "/admin/email/outbox",
          label: "Email",
          icon: Mail,
          requirement: EMAIL_OUTBOX_ACCESS,
        },
        {
          href: "/admin/audit/events",
          label: "Audit",
          icon: FileText,
          requirement: AUDIT_ACCESS,
        },
        {
          href: "/admin/settings/platform",
          label: "System",
          icon: Settings,
          requirement: "platform.admin.full",
        },
        {
          href: "/admin/cms",
          label: "CMS",
          icon: LayoutGrid,
          requirement: CMS_ACCESS,
        },
      ],
    },
  ];

  return filterGroups(role, staffRole, groups);
}
