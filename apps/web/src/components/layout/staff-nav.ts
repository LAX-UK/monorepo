import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import { inboxNavCount } from "@/lib/admin/consignment-inbox/inbox-presenters";
import { STAFF_ACCESS_REVIEW_PATH } from "@/lib/admin/people/staff-access-review.vm";
import {
  type AdminNavCounts,
  EMPTY_ADMIN_NAV_COUNTS,
} from "@/lib/data/http/admin-nav-counts.types";
import { canOpenAdminRoute } from "@/lib/navigation/admin-route-access";
/**
 * Single source of truth for staff (platform + finance shell) sidebar navigation.
 * Grouped for accordion UI; flattened for command palette and legacy consumers.
 */
import {
  AML_REVIEW_ACCESS,
  ARTISTS_ACCESS,
  AUDIT_DOMAIN_EVENTS_ACCESS,
  CATEGORIES_READ_ACCESS,
  CONDITION_REPORTS_READ_ACCESS,
  CONSIGNMENT_INBOX_READ_ACCESS,
  FINANCE_ACCESS,
  INVITATIONS_ACCESS,
  LEGAL_ENTITY_BROWSE_ACCESS,
  LOTS_READ_ACCESS,
  LOT_FULFILMENT_ACCESS,
  ONBOARDING_QUEUES_ACCESS,
  PLATFORM_ADMIN_ACCESS,
  SALEROOM_ACCESS,
  SALE_CATALOG_READ_ACCESS,
  STAFF_ACCESS_REVIEW_ACCESS,
  STAFF_OVERVIEW_ACCESS,
  SUBMISSIONS_READ_ACCESS,
  USERS_DIRECTORY_ACCESS,
  VENUES_READ_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import type { NavBadgeTone } from "@/lib/shell/contracts";
import type { CapabilityRequirement, StaffRoles, UserRole } from "@auction/types";
import {
  AlertTriangle,
  Banknote,
  Brush,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Gauge,
  History,
  Inbox,
  KeyRound,
  ListTree,
  Mail,
  MapPin,
  MonitorPlay,
  MoreHorizontal,
  Package,
  PartyPopper,
  Plug,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
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
  staffRoles: StaffRoles | undefined,
  item: StaffNavItemSpec,
): boolean {
  return canOpenAdminRoute(role, staffRoles, item.href, item.requirement);
}

function filterGroups(
  role: UserRole,
  staffRoles: StaffRoles | undefined,
  groups: readonly StaffNavGroupSpec[],
): StaffNavGroupSpec[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => filterNavItem(role, staffRoles, item)),
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
          requirement: SUBMISSIONS_READ_ACCESS,
        }
      : {
          id: "submissions",
          href: "/admin/submissions",
          label: "Submissions",
          icon: Upload,
          requirement: SUBMISSIONS_READ_ACCESS,
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
          // A daily queue, so it sits in the top block: the count is the unanswered client
          // messages this person has.
          id: "inbox",
          href: "/admin/inbox",
          label: "Inbox",
          icon: Inbox,
          requirement: CONSIGNMENT_INBOX_READ_ACCESS,
          ...navBadge(inboxNavCount(navCounts.inboxWaitingForYou) ?? 0, "warning"),
        },
      ],
    },
    {
      id: "catalog",
      title: "Catalogue",
      icon: Package,
      items: [
        {
          id: "sales",
          href: "/admin/sales",
          label: "Sales",
          icon: ScrollText,
          requirement: SALE_CATALOG_READ_ACCESS,
        },
        {
          id: "lots",
          href: "/admin/lots",
          label: "Lots",
          icon: Package,
          match: (pathname) => pathname === "/admin/lots" || pathname.startsWith("/admin/lots/"),
          requirement: LOTS_READ_ACCESS,
          ...navBadge(navCounts.withdrawalsPending, "warning"),
        },
        submissions,
        {
          id: "condition-reports",
          href: "/admin/condition-reports",
          label: "Condition reports",
          icon: ClipboardList,
          requirement: CONDITION_REPORTS_READ_ACCESS,
          ...navBadge(navCounts.conditionReportsPending, "warning"),
        },
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
          requirement: SALEROOM_ACCESS,
          ...(navCounts.telephoneBookingsPending > 0
            ? navBadge(navCounts.telephoneBookingsPending, "warning")
            : navBadge(navCounts.saleroomLiveCount, "live")),
        },
        {
          id: "event-rsvps",
          href: "/admin/event-rsvps",
          label: "Event RSVPs",
          icon: PartyPopper,
          match: (pathname) => pathname.startsWith("/admin/event-rsvps"),
          requirement: SALEROOM_ACCESS,
        },
        {
          id: "lot-fulfilment",
          href: "/admin/lot-fulfilment",
          label: "Lot fulfilment",
          icon: Truck,
          match: (pathname) => pathname.startsWith("/admin/lot-fulfilment"),
          requirement: LOT_FULFILMENT_ACCESS,
          ...navBadge(navCounts.lotFulfilmentPending, "warning"),
        },
        {
          id: "onboarding-issues",
          href: "/admin/onboarding-issues",
          label: "Onboarding issues",
          icon: AlertTriangle,
          match: (pathname) => pathname.startsWith("/admin/onboarding-issues"),
          requirement: ONBOARDING_QUEUES_ACCESS,
          ...navBadge(navCounts.onboardingIssuesTotal, "warning"),
        },
        {
          id: "audit-log",
          href: "/admin/audit",
          label: "Audit log",
          icon: History,
          match: (pathname) => pathname.startsWith("/admin/audit"),
          requirement: AUDIT_DOMAIN_EVENTS_ACCESS,
        },
      ],
    },
    {
      id: "compliance",
      title: "Compliance",
      icon: ShieldCheck,
      items: [
        {
          id: "compliance-aml",
          href: "/admin/compliance/aml",
          label: "AML screening",
          icon: ShieldCheck,
          match: (pathname) => pathname.startsWith("/admin/compliance/aml"),
          requirement: AML_REVIEW_ACCESS,
          ...navBadge(navCounts.amlScreeningsPending, "danger"),
        },
        {
          id: "compliance-sof",
          href: "/admin/compliance/source-of-funds",
          label: "Source of Funds",
          icon: ShieldAlert,
          match: (pathname) => pathname.startsWith("/admin/compliance/source-of-funds"),
          requirement: AML_REVIEW_ACCESS,
          ...navBadge(navCounts.sourceOfFundsPending, "warning"),
        },
      ],
    },
    {
      id: "finance",
      title: "Finance",
      icon: WalletCards,
      items: [
        {
          id: "finance-overview",
          href: "/admin/finance",
          label: "Finance overview",
          icon: Gauge,
          match: (pathname) => pathname === "/admin/finance",
          requirement: FINANCE_ACCESS,
        },
        {
          id: "payments",
          href: "/admin/payments",
          label: "Payments",
          icon: WalletCards,
          match: (pathname) =>
            pathname === "/admin/payments" || pathname.startsWith("/admin/payments/"),
          requirement: FINANCE_ACCESS,
          ...navBadge(navCounts.manualReviewCount, "danger"),
        },
        {
          id: "disputes",
          href: "/admin/disputes",
          label: "Disputes",
          icon: ShieldAlert,
          requirement: FINANCE_ACCESS,
          ...navBadge(navCounts.disputesOpen, "danger"),
        },
        {
          id: "payouts",
          href: "/admin/payouts",
          label: "Payouts",
          icon: Banknote,
          requirement: FINANCE_ACCESS,
          ...navBadge(navCounts.payoutsFailed, "danger"),
        },
        {
          id: "xero",
          href: "/admin/integrations/xero",
          label: "Xero",
          icon: Plug,
          requirement: FINANCE_ACCESS,
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
          requirement: USERS_DIRECTORY_ACCESS,
        },
        {
          id: "staff",
          href: "/admin/staff",
          label: "Staff",
          icon: ShieldCheck,
          requirement: USERS_DIRECTORY_ACCESS,
          // The directory and staff records; the access review has its own item.
          match: (pathname) =>
            exactOrNested("/admin/staff")(pathname) &&
            !exactOrNested(STAFF_ACCESS_REVIEW_PATH)(pathname),
        },
        {
          id: "staff-access",
          href: STAFF_ACCESS_REVIEW_PATH,
          label: "Access review",
          match: exactOrNested(STAFF_ACCESS_REVIEW_PATH),
          icon: ClipboardCheck,
          requirement: STAFF_ACCESS_REVIEW_ACCESS,
        },
        {
          id: "legal-entities",
          href: "/admin/legal-entities",
          label: "Legal entities",
          icon: Building2,
          match: (pathname) => pathname.startsWith("/admin/legal-entities"),
          requirement: LEGAL_ENTITY_BROWSE_ACCESS,
          ...navBadge(navCounts.legalEntityStripeRequirementsCount, "warning"),
        },
        {
          id: "invitations",
          href: "/admin/invitations",
          label: "Invitations",
          icon: Mail,
          requirement: INVITATIONS_ACCESS,
          ...navBadge(navCounts.invitationsPending, "default"),
        },
        {
          id: "security",
          href: "/admin/settings/security",
          label: "Security",
          icon: KeyRound,
          requirement: PLATFORM_ADMIN_ACCESS,
        },
      ],
    },
    {
      id: "setup",
      title: "Setup",
      icon: SlidersHorizontal,
      items: [
        {
          id: "categories",
          href: "/admin/categories",
          label: "Categories",
          icon: ListTree,
          requirement: CATEGORIES_READ_ACCESS,
        },
        {
          id: "venues",
          href: "/admin/venues",
          label: "Venues",
          icon: MapPin,
          match: (pathname) => pathname.startsWith("/admin/venues"),
          requirement: VENUES_READ_ACCESS,
        },
        {
          id: "artists",
          href: "/admin/artists",
          label: "Artists",
          icon: Brush,
          ...(pendingArtistCount > 0 ? { badge: pendingArtistCount } : {}),
          requirement: ARTISTS_ACCESS,
        },
      ],
    },
  ];
}

export function getStaffNavGroups(
  role: UserRole,
  pendingSubmissionCount: number,
  staffRoles?: StaffRoles | undefined,
  pendingArtistCount = 0,
  navCounts?: AdminNavCounts,
): StaffNavGroupSpec[] {
  return filterGroups(
    role,
    staffRoles,
    buildStaffNavGroupSpecs(pendingSubmissionCount, pendingArtistCount, navCounts),
  );
}

/** Flat sidebar items (legacy / mobile bottom sheet). */
export function getStaffNavItems(
  role: UserRole,
  staffRoles: StaffRoles | undefined,
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
  navCounts?: AdminNavCounts,
): AppShellNavItem[] {
  return getStaffNavGroups(
    role,
    pendingSubmissionCount,
    staffRoles,
    pendingArtistCount,
    navCounts,
  ).flatMap((g) => g.items.map((spec) => staffNavItemToAppShellItem(spec)));
}

/** Longest-prefix nav item label for nested admin routes (breadcrumbs parent). */
export function getStaffNavParentLabel(
  pathname: string,
  role: UserRole,
  staffRoles: StaffRoles | undefined,
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
  navCounts?: AdminNavCounts,
): string | null {
  const items = getStaffNavGroups(
    role,
    pendingSubmissionCount,
    staffRoles,
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
  staffRoles: StaffRoles | undefined,
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
  financeOnly = false,
  navCounts?: AdminNavCounts,
): AppShellNavItem[] {
  const allowed = new Set<string>(financeOnly ? FINANCE_MOBILE_TAB_IDS : STAFF_MOBILE_TAB_IDS);
  const items = getStaffNavItems(
    role,
    staffRoles,
    pendingSubmissionCount,
    pendingArtistCount,
    navCounts,
  ).filter((item) => allowed.has(item.id));
  if (!items.some((i) => i.id === "more")) {
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

/**
 * The navigation item a path belongs to (longest matching link), whatever the person's role:
 * the page's name and the capability it needs, e.g. to explain an access refusal.
 */
export function findStaffNavItemForPath(pathname: string): StaffNavItemSpec | null {
  const path = pathname.split(/[?#]/)[0] ?? pathname;
  let best: StaffNavItemSpec | null = null;
  for (const item of buildStaffNavGroupSpecs(0).flatMap((group) => group.items)) {
    const matches = path === item.href || path.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}
