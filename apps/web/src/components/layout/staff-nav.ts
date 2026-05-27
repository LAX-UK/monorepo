import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import {
  type AdminNavCounts,
  EMPTY_ADMIN_NAV_COUNTS,
} from "@/lib/data/http/admin-nav-counts.types";
/**
 * Single source of truth for staff (platform + finance shell) sidebar navigation.
 * Grouped for accordion UI; flattened for command palette and legacy consumers.
 */
import {
  CATEGORIES_ACCESS,
  CONDITION_REPORTS_ACCESS,
  CONVEYOR_ACCESS,
  LOTS_ACCESS,
  SALE_CATALOG_ACCESS,
  STAFF_OVERVIEW_ACCESS,
  SUBMISSIONS_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import type { NavBadgeTone } from "@/lib/shell/contracts";
import type { CapabilityRequirement, UserRole, UserStaffRole } from "@auction/types";
import { userHasAccessTo } from "@auction/types";
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Brush,
  Building2,
  ClipboardList,
  Gauge,
  ListTree,
  Mail,
  MonitorPlay,
  MonitorSmartphone,
  MoreHorizontal,
  Package,
  Plug,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
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
  badgeTone?: NavBadgeTone;
  match?: (pathname: string) => boolean;
  requirement: CapabilityRequirement;
};

function navBadge(
  count: number,
  tone: NavBadgeTone = "default",
): Pick<StaffNavItemSpec, "badge" | "badgeTone"> | Record<string, never> {
  return count > 0 ? { badge: count, badgeTone: tone } : {};
}

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
  navCounts: AdminNavCounts = EMPTY_ADMIN_NAV_COUNTS,
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
          label: "Dashboard",
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
          requirement: SALE_CATALOG_ACCESS,
        },
        {
          id: "lots",
          href: "/admin/lots",
          label: "Lots",
          icon: Package,
          match: (pathname) =>
            pathname === "/admin/lots" ||
            (pathname.startsWith("/admin/lots/") &&
              !pathname.startsWith("/admin/lots/withdrawals")),
          requirement: LOTS_ACCESS,
          ...navBadge(navCounts.withdrawalsPending, "warning"),
        },
        {
          id: "categories",
          href: "/admin/categories",
          label: "Categories",
          icon: ListTree,
          requirement: CATEGORIES_ACCESS,
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
          ...navBadge(navCounts.saleroomLiveCount, "live"),
        },
        {
          id: "conveyor",
          href: "/admin/conveyor",
          label: "Conveyor",
          icon: Workflow,
          match: (pathname) => pathname.startsWith("/admin/conveyor"),
          requirement: CONVEYOR_ACCESS,
        },
        {
          id: "lot-fulfilment",
          href: "/admin/lot-fulfilment",
          label: "Lot fulfilment",
          icon: Truck,
          match: (pathname) => pathname.startsWith("/admin/lot-fulfilment"),
          requirement: "operations.fulfilment",
          ...navBadge(navCounts.lotFulfilmentPending, "warning"),
        },
        {
          id: "condition-reports",
          href: "/admin/condition-reports",
          label: "Condition reports",
          icon: ClipboardList,
          requirement: CONDITION_REPORTS_ACCESS,
          ...navBadge(navCounts.conditionReportsPending, "warning"),
        },
        {
          id: "onboarding-issues",
          href: "/admin/onboarding-issues",
          label: "Onboarding issues",
          icon: AlertTriangle,
          match: (pathname) => pathname.startsWith("/admin/onboarding-issues"),
          requirement: STAFF_OVERVIEW_ACCESS,
          ...navBadge(navCounts.onboardingIssuesTotal, "warning"),
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
          match: (pathname) =>
            pathname === "/admin/payments" ||
            (pathname.startsWith("/admin/payments/") &&
              !pathname.startsWith("/admin/payments/manual-review")),
          requirement: "finance.read",
          ...navBadge(navCounts.manualReviewCount, "danger"),
        },
        {
          id: "disputes",
          href: "/admin/disputes",
          label: "Disputes",
          icon: ShieldAlert,
          requirement: "finance.read",
          ...navBadge(navCounts.disputesOpen, "danger"),
        },
        {
          id: "payouts",
          href: "/admin/payouts",
          label: "Payouts",
          icon: Banknote,
          requirement: "finance.read",
          ...navBadge(navCounts.payoutsFailed, "danger"),
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
          id: "clients",
          href: "/admin/clients",
          label: "Clients",
          icon: Users,
          requirement: "platform.admin.full",
        },
        {
          id: "staff",
          href: "/admin/staff",
          label: "Staff",
          icon: ShieldCheck,
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
          ...navBadge(navCounts.invitationsPending, "default"),
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
  ];
}

export function getStaffNavGroups(
  role: UserRole,
  pendingSubmissionCount: number,
  staffRole?: UserStaffRole | null,
  pendingArtistCount = 0,
  navCounts?: AdminNavCounts,
): StaffNavGroupSpec[] {
  return filterGroups(
    role,
    staffRole,
    buildStaffNavGroupSpecs(pendingSubmissionCount, pendingArtistCount, navCounts),
  );
}

/** Flat sidebar items (legacy / mobile bottom sheet). */
export function getStaffNavItems(
  role: UserRole,
  staffRole: UserStaffRole | null | undefined,
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
  navCounts?: AdminNavCounts,
): AppShellNavItem[] {
  return getStaffNavGroups(
    role,
    pendingSubmissionCount,
    staffRole,
    pendingArtistCount,
    navCounts,
  ).flatMap((g) => g.items.map((spec) => staffNavItemToAppShellItem(spec)));
}

/** Longest-prefix nav item label for nested admin routes (breadcrumbs parent). */
export function getStaffNavParentLabel(
  pathname: string,
  role: UserRole,
  staffRole: UserStaffRole | null | undefined,
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
  navCounts?: AdminNavCounts,
): string | null {
  const items = getStaffNavGroups(
    role,
    pendingSubmissionCount,
    staffRole,
    pendingArtistCount,
    navCounts,
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

const STAFF_MOBILE_TAB_IDS = ["home", "submissions", "lots", "sales", "more"] as const;
const FINANCE_MOBILE_TAB_IDS = ["payments", "disputes", "payouts", "xero"] as const;

/** Primary staff routes for the mobile bottom bar (max 5). */
export function getStaffMobileBottomTabs(
  role: UserRole,
  staffRole: UserStaffRole | null | undefined,
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
  financeOnly = false,
  navCounts?: AdminNavCounts,
): AppShellNavItem[] {
  const allowed = new Set<string>(financeOnly ? FINANCE_MOBILE_TAB_IDS : STAFF_MOBILE_TAB_IDS);
  const items = getStaffNavItems(
    role,
    staffRole,
    pendingSubmissionCount,
    pendingArtistCount,
    navCounts,
  ).filter((item) => allowed.has(item.id));
  if (!financeOnly && !items.some((i) => i.id === "more")) {
    items.push({
      id: "more",
      href: "#more",
      label: "More",
      icon: MoreHorizontal,
      match: () => false,
    });
  }
  return items;
}

export function staffNavItemToAppShellItem(spec: StaffNavItemSpec): AppShellNavItem {
  const base: AppShellNavItem = {
    id: spec.id,
    href: spec.href,
    label: spec.label,
    icon: spec.icon,
    match: spec.match ?? exactOrNested(spec.href),
  };
  return {
    ...base,
    ...(spec.badge !== undefined ? { badge: spec.badge } : {}),
    ...(spec.badgeTone !== undefined ? { badgeTone: spec.badgeTone } : {}),
  };
}
