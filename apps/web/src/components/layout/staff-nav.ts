import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
/**
 * Single source of truth for staff (platform + finance shell) sidebar navigation.
 * Grouped for accordion UI; flattened for command palette and legacy consumers.
 */
import {
  AUDIT_ACCESS,
  CMS_ACCESS,
  CONDITION_REPORTS_ACCESS,
  EMAIL_OUTBOX_ACCESS,
  STAFF_OVERVIEW_ACCESS,
  SUBMISSIONS_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import type { CapabilityRequirement, UserRole, UserStaffRole } from "@auction/types";
import { userHasAccessTo } from "@auction/types";
import {
  AlertTriangle,
  BarChart3,
  Brush,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  Gauge,
  LayoutGrid,
  ListTree,
  Mail,
  MonitorPlay,
  MonitorSmartphone,
  Package,
  Plug,
  ScrollText,
  Settings,
  ShieldAlert,
  Truck,
  Upload,
  Users,
  WalletCards,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

function exactOrNested(href: string) {
  return (pathname: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export type StaffNavItemSpec = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  match?: (pathname: string) => boolean;
  requirement: CapabilityRequirement;
};

export type StaffNavGroupSpec = {
  /** Stable id for accordion localStorage (e.g. lax.staffNav.open.catalog). */
  id: string;
  title: string;
  icon: LucideIcon;
  items: readonly StaffNavItemSpec[];
};

function filterNavItem(
  role: UserRole,
  staffRole: UserStaffRole | null | undefined,
  item: StaffNavItemSpec,
): boolean {
  return userHasAccessTo(role, staffRole ?? null, item.requirement);
}

function filterGroups(
  role: UserRole,
  staffRole: UserStaffRole | null | undefined,
  groups: readonly StaffNavGroupSpec[],
): StaffNavGroupSpec[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => filterNavItem(role, staffRole, item)),
    }))
    .filter((g) => g.items.length > 0);
}

function buildStaffNavGroupSpecs(
  pendingSubmissionCount: number,
  pendingArtistCount = 0,
): readonly StaffNavGroupSpec[] {
  const submissions: StaffNavItemSpec =
    pendingSubmissionCount > 0
      ? {
          id: "submissions",
          href: "/admin/submissions",
          label: "Submissions",
          icon: Upload,
          badge: pendingSubmissionCount,
          requirement: SUBMISSIONS_ACCESS,
        }
      : {
          id: "submissions",
          href: "/admin/submissions",
          label: "Submissions",
          icon: Upload,
          requirement: SUBMISSIONS_ACCESS,
        };

  return [
    {
      id: "overview",
      title: "Overview",
      icon: Gauge,
      items: [
        {
          id: "home",
          href: "/admin",
          label: "Operations",
          icon: Gauge,
          match: (pathname) => pathname === "/admin",
          requirement: STAFF_OVERVIEW_ACCESS,
        },
        {
          id: "analytics",
          href: "/admin/analytics",
          label: "Analytics",
          icon: BarChart3,
          requirement: "platform.admin.full",
        },
      ],
    },
    {
      id: "catalog",
      title: "Catalog",
      icon: Package,
      items: [
        {
          id: "sales",
          href: "/admin/sales",
          label: "Sales",
          icon: ScrollText,
          requirement: "auction.manage",
        },
        {
          id: "lots",
          href: "/admin/lots",
          label: "Lots",
          icon: Package,
          requirement: "catalogue.write",
        },
        {
          id: "categories",
          href: "/admin/categories",
          label: "Categories",
          icon: ListTree,
          requirement: "catalogue.write",
        },
        {
          id: "artists",
          href: "/admin/artists",
          label: "Artists",
          icon: Brush,
          ...(pendingArtistCount > 0 ? { badge: pendingArtistCount } : {}),
          requirement: "artist.read",
        },
        submissions,
      ],
    },
    {
      id: "operations",
      title: "Operations",
      icon: Workflow,
      items: [
        {
          id: "saleroom",
          href: "/admin/saleroom",
          label: "Saleroom",
          icon: MonitorPlay,
          requirement: "auction.manage",
        },
        {
          id: "conveyor",
          href: "/admin/conveyor",
          label: "Conveyor",
          icon: Workflow,
          match: (pathname) => pathname.startsWith("/admin/conveyor"),
          requirement: "operations.fulfilment",
        },
        {
          id: "lot-fulfilment",
          href: "/admin/lot-fulfilment",
          label: "Lot fulfilment",
          icon: Truck,
          match: (pathname) => pathname.startsWith("/admin/lot-fulfilment"),
          requirement: "operations.fulfilment",
        },
        {
          id: "condition-reports",
          href: "/admin/condition-reports",
          label: "Condition reports",
          icon: ClipboardList,
          requirement: CONDITION_REPORTS_ACCESS,
        },
        {
          id: "onboarding-issues",
          href: "/admin/onboarding-issues",
          label: "Onboarding issues",
          icon: AlertTriangle,
          match: (pathname) => pathname.startsWith("/admin/onboarding-issues"),
          requirement: STAFF_OVERVIEW_ACCESS,
        },
      ],
    },
    {
      id: "finance",
      title: "Finance",
      icon: WalletCards,
      items: [
        {
          id: "payments",
          href: "/admin/payments",
          label: "Payments",
          icon: WalletCards,
          requirement: "finance.read",
        },
        {
          id: "manual-review",
          href: "/admin/payments/manual-review",
          label: "Manual review",
          icon: CreditCard,
          match: (pathname) => pathname.startsWith("/admin/payments/manual-review"),
          requirement: "finance.read",
        },
        {
          id: "disputes",
          href: "/admin/disputes",
          label: "Disputes",
          icon: ShieldAlert,
          requirement: "finance.read",
        },
        {
          id: "payouts",
          href: "/admin/payouts",
          label: "Payouts",
          icon: WalletCards,
          requirement: "finance.read",
        },
        {
          id: "xero",
          href: "/admin/integrations/xero",
          label: "Xero",
          icon: Plug,
          requirement: "finance.read",
        },
      ],
    },
    {
      id: "people",
      title: "People",
      icon: Users,
      items: [
        {
          id: "users",
          href: "/admin/users",
          label: "Users",
          icon: Users,
          requirement: "platform.admin.full",
        },
        {
          id: "legal-entities",
          href: "/admin/legal-entities",
          label: "Legal entities",
          icon: Building2,
          match: (pathname) => pathname.startsWith("/admin/legal-entities"),
          requirement: "legal_entity.read",
        },
        {
          id: "invitations",
          href: "/admin/invitations",
          label: "Invitations",
          icon: Mail,
          requirement: "platform.admin.full",
        },
        {
          id: "impersonation",
          href: "/admin/impersonation",
          label: "Impersonate",
          icon: MonitorSmartphone,
          requirement: "platform.admin.full",
        },
      ],
    },
    {
      id: "platform",
      title: "Platform",
      icon: Settings,
      items: [
        {
          id: "email-outbox",
          href: "/admin/email/outbox",
          label: "Email outbox",
          icon: Mail,
          match: (pathname) => pathname.startsWith("/admin/email/outbox"),
          requirement: EMAIL_OUTBOX_ACCESS,
        },
        {
          id: "email-suppressions",
          href: "/admin/email/suppressions",
          label: "Email suppressions",
          icon: Mail,
          match: (pathname) => pathname.startsWith("/admin/email/suppressions"),
          requirement: EMAIL_OUTBOX_ACCESS,
        },
        {
          id: "email-templates",
          href: "/admin/email/templates",
          label: "Email templates",
          icon: Mail,
          match: (pathname) => pathname.startsWith("/admin/email/templates"),
          requirement: EMAIL_OUTBOX_ACCESS,
        },
        {
          id: "cms",
          href: "/admin/cms",
          label: "CMS",
          icon: LayoutGrid,
          match: (pathname) => pathname.startsWith("/admin/cms"),
          requirement: CMS_ACCESS,
        },
        {
          id: "audit-events",
          href: "/admin/audit/events",
          label: "Audit events",
          icon: FileText,
          match: (pathname) =>
            pathname.startsWith("/admin/audit/events") || pathname === "/admin/audit/events",
          requirement: AUDIT_ACCESS,
        },
        {
          id: "audit-timeline",
          href: "/admin/audit/timeline",
          label: "Audit timeline",
          icon: FileText,
          match: (pathname) => pathname.startsWith("/admin/audit/timeline"),
          requirement: AUDIT_ACCESS,
        },
        {
          id: "audit-webhooks",
          href: "/admin/audit/webhooks",
          label: "Audit webhooks",
          icon: FileText,
          match: (pathname) => pathname.startsWith("/admin/audit/webhooks"),
          requirement: AUDIT_ACCESS,
        },
        {
          id: "system",
          href: "/admin/settings/platform",
          label: "System",
          icon: Settings,
          match: (pathname) => pathname.startsWith("/admin/settings"),
          requirement: "platform.admin.full",
        },
      ],
    },
  ];
}

export function getStaffNavGroups(
  role: UserRole,
  pendingSubmissionCount: number,
  staffRole?: UserStaffRole | null,
  pendingArtistCount = 0,
): StaffNavGroupSpec[] {
  return filterGroups(
    role,
    staffRole,
    buildStaffNavGroupSpecs(pendingSubmissionCount, pendingArtistCount),
  );
}

/** Flat sidebar items (legacy / mobile bottom sheet). */
export function getStaffNavItems(
  role: UserRole,
  staffRole: UserStaffRole | null | undefined,
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
): AppShellNavItem[] {
  return getStaffNavGroups(role, pendingSubmissionCount, staffRole, pendingArtistCount).flatMap(
    (g) => g.items.map((spec) => staffNavItemToAppShellItem(spec)),
  );
}

/** Longest-prefix nav item label for nested admin routes (breadcrumbs parent). */
export function getStaffNavParentLabel(
  pathname: string,
  role: UserRole,
  staffRole: UserStaffRole | null | undefined,
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
): string | null {
  const items = getStaffNavGroups(
    role,
    pendingSubmissionCount,
    staffRole,
    pendingArtistCount,
  ).flatMap((g) => g.items);
  let best: { hrefLen: number; label: string } | null = null;

  for (const item of items) {
    const isActive = item.match
      ? item.match(pathname)
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!isActive) continue;
    if (pathname === item.href) continue;
    const hrefLen = item.href.length;
    if (!best || hrefLen > best.hrefLen) {
      best = { hrefLen, label: item.label };
    }
  }
  return best?.label ?? null;
}

/** Which accordion group should be open for the current path (longest matching child). */
export function getStaffNavActiveGroupId(
  pathname: string,
  role: UserRole,
  staffRole: UserStaffRole | null | undefined,
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
): string | null {
  const groups = getStaffNavGroups(role, pendingSubmissionCount, staffRole, pendingArtistCount);
  let best: { score: number; groupId: string } | null = null;

  for (const g of groups) {
    for (const item of g.items) {
      const isActive = item.match
        ? item.match(pathname)
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (!isActive) continue;
      const score = item.href.length + (pathname === item.href ? 1000 : 0);
      if (!best || score > best.score) {
        best = { score, groupId: g.id };
      }
    }
  }
  return best?.groupId ?? null;
}

export function staffNavItemToAppShellItem(spec: StaffNavItemSpec): AppShellNavItem {
  const base: AppShellNavItem = {
    id: spec.id,
    href: spec.href,
    label: spec.label,
    icon: spec.icon,
    match: spec.match ?? exactOrNested(spec.href),
  };
  return spec.badge !== undefined ? { ...base, badge: spec.badge } : base;
}
