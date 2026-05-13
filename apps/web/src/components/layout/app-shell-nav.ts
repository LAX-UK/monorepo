import type { SessionUser } from "@/lib/data/contracts";
import {
  AUDIT_ACCESS,
  CMS_ACCESS,
  CONDITION_REPORTS_ACCESS,
  EMAIL_OUTBOX_ACCESS,
  STAFF_OVERVIEW_ACCESS,
  SUBMISSIONS_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import type {
  AppShellLayout,
  CapabilityRequirement,
  UserRole,
  UserStaffRole,
} from "@auction/types";
import { staffRoleToShellLayout, userHasAccessTo } from "@auction/types";
import {
  BarChart3,
  Bell,
  Brush,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  Gauge,
  Heart,
  Layers,
  LayoutGrid,
  ListTree,
  Mail,
  Menu,
  MonitorPlay,
  MonitorSmartphone,
  Package,
  Plug,
  ScrollText,
  Settings,
  ShieldAlert,
  Store,
  TrendingUp,
  Truck,
  Upload,
  Users,
  WalletCards,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Visual shell segment for the dashboard chrome. */
export type AppShellRole = AppShellLayout;

/** Maps session user to shell layout (client vs platform admin vs finance). */
export function sessionUserToShellRole(
  user: Pick<SessionUser, "role" | "staffRole">,
): AppShellRole {
  return staffRoleToShellLayout(user.role as UserRole, user.staffRole ?? null);
}

export type AppShellNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  match?: (pathname: string) => boolean;
};

export type AppShellRoleMeta = {
  label: string;
  workspaceLabel: string;
  dotClassName: string;
  pillClassName: string;
};

export const appShellRoleMeta: Record<AppShellRole, AppShellRoleMeta> = {
  client: {
    label: "Client",
    workspaceLabel: "Client",
    dotClassName: "bg-[#e8c77c]",
    pillClassName: "border-[#e8c77c]/40 bg-[#e8c77c]/15 text-[#775a19] dark:text-[#e8c77c]",
  },
  platform: {
    label: "Staff",
    workspaceLabel: "Admin",
    dotClassName: "bg-blue-500",
    pillClassName: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  finance: {
    label: "Finance",
    workspaceLabel: "Finance",
    dotClassName: "bg-emerald-500",
    pillClassName: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
};

function exactOrNested(href: string) {
  return (pathname: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Collector-focused navigation (bidding & collection). */
export function getClientBuyingNavItems(): AppShellNavItem[] {
  return [
    {
      id: "overview",
      label: "Overview",
      href: "/dashboard",
      icon: LayoutGrid,
      match: (pathname) => pathname === "/dashboard",
    },
    { id: "bids", label: "My Bids", href: "/dashboard/bids", icon: TrendingUp },
    { id: "portfolio", label: "Collection", href: "/dashboard/portfolio", icon: Package },
    { id: "payments", label: "My payments", href: "/dashboard/payments", icon: CreditCard },
    { id: "watchlist", label: "Watchlist", href: "/dashboard/watchlist", icon: Heart },
    { id: "notifications", label: "Notifications", href: "/dashboard/notifications", icon: Bell },
    {
      id: "settings",
      label: "Settings",
      href: "/dashboard/settings/profile",
      icon: Settings,
      match: exactOrNested("/dashboard/settings"),
    },
  ];
}

/** Seller & artist workspace navigation. */
export function getClientSellingNavItems(): AppShellNavItem[] {
  return [
    {
      id: "seller-overview",
      label: "Seller overview",
      href: "/dashboard/seller",
      icon: Store,
      match: (pathname) => pathname === "/dashboard/seller",
    },
    {
      id: "submissions",
      label: "Submissions",
      href: "/dashboard/submissions",
      icon: Upload,
      match: exactOrNested("/dashboard/submissions"),
    },
    {
      id: "in-sale",
      label: "Items in sale",
      href: "/dashboard/seller/in-sale",
      icon: Layers,
    },
    {
      id: "payouts",
      label: "Sold & payouts",
      href: "/dashboard/seller/payouts",
      icon: WalletCards,
    },
    {
      id: "artist",
      label: "Artist profile",
      href: "/dashboard/seller/artist",
      icon: Brush,
    },
    {
      id: "team",
      label: "Team",
      href: "/dashboard/team",
      icon: Users,
    },
    { id: "notifications", label: "Notifications", href: "/dashboard/notifications", icon: Bell },
    {
      id: "settings",
      label: "Settings",
      href: "/dashboard/settings/profile",
      icon: Settings,
      match: exactOrNested("/dashboard/settings"),
    },
  ];
}

export function getClientNavItems(workspace: ClientWorkspaceMode = "buying"): AppShellNavItem[] {
  return workspace === "selling" ? getClientSellingNavItems() : getClientBuyingNavItems();
}

export function getClientMobileBottomTabs(
  workspace: ClientWorkspaceMode = "buying",
): AppShellNavItem[] {
  const more = {
    id: "more",
    label: "More",
    href: "#more",
    icon: Menu,
  };
  if (workspace === "selling") {
    const selling = getClientSellingNavItems();
    return [
      selling.find((item) => item.id === "seller-overview"),
      selling.find((item) => item.id === "submissions"),
      selling.find((item) => item.id === "in-sale"),
      selling.find((item) => item.id === "notifications"),
      more,
    ].filter((item): item is AppShellNavItem => item != null);
  }
  const buying = getClientBuyingNavItems();
  return [
    buying.find((item) => item.id === "overview"),
    buying.find((item) => item.id === "bids"),
    buying.find((item) => item.id === "watchlist"),
    buying.find((item) => item.id === "notifications"),
    more,
  ].filter((item): item is AppShellNavItem => item != null);
}

type StaffNavSpec = AppShellNavItem & { requirement: CapabilityRequirement };

function buildStaffNavSpecs(pendingSubmissionCount: number): StaffNavSpec[] {
  return [
    {
      id: "overview",
      label: "Operations",
      href: "/admin",
      icon: Gauge,
      match: (pathname) => pathname === "/admin",
      requirement: STAFF_OVERVIEW_ACCESS,
    },
    {
      id: "lots",
      label: "Lots",
      href: "/admin/lots",
      icon: Package,
      requirement: "catalogue.write",
    },
    {
      id: "sales",
      label: "Sales",
      href: "/admin/sales",
      icon: ScrollText,
      requirement: "auction.manage",
    },
    {
      id: "categories",
      label: "Categories",
      href: "/admin/categories",
      icon: ListTree,
      requirement: "catalogue.write",
    },
    {
      id: "artists",
      label: "Artists",
      href: "/admin/artists",
      icon: Brush,
      requirement: "artist.read",
    },
    {
      id: "submissions",
      label: "Submissions",
      href: "/admin/submissions",
      icon: Upload,
      ...(pendingSubmissionCount > 0 ? { badge: pendingSubmissionCount } : {}),
      requirement: SUBMISSIONS_ACCESS,
    },
    {
      id: "condition-reports",
      label: "Condition reports",
      href: "/admin/condition-reports",
      icon: ClipboardList,
      requirement: CONDITION_REPORTS_ACCESS,
    },
    {
      id: "conveyor",
      label: "Conveyor",
      href: "/admin/conveyor",
      icon: Workflow,
      match: (pathname) => pathname.startsWith("/admin/conveyor"),
      requirement: "operations.fulfilment",
    },
    {
      id: "users",
      label: "Users",
      href: "/admin/users",
      icon: Users,
      requirement: "platform.admin.full",
    },
    {
      id: "impersonation",
      label: "Impersonate",
      href: "/admin/impersonation",
      icon: MonitorSmartphone,
      requirement: "platform.admin.full",
    },
    {
      id: "legal-entities",
      label: "Legal entities",
      href: "/admin/legal-entities",
      icon: Building2,
      match: (pathname) => pathname.startsWith("/admin/legal-entities"),
      requirement: "legal_entity.read",
    },
    {
      id: "analytics",
      label: "Analytics",
      href: "/admin/analytics",
      icon: BarChart3,
      requirement: "platform.admin.full",
    },
    {
      id: "admin-payments",
      label: "Payments",
      href: "/admin/payments",
      icon: WalletCards,
      requirement: "finance.read",
    },
    {
      id: "admin-disputes",
      label: "Disputes",
      href: "/admin/disputes",
      icon: ShieldAlert,
      requirement: "finance.read",
    },
    {
      id: "payouts",
      label: "Payouts",
      href: "/admin/payouts",
      icon: WalletCards,
      requirement: "finance.read",
    },
    {
      id: "invitations",
      label: "Invitations",
      href: "/admin/invitations",
      icon: Mail,
      requirement: "platform.admin.full",
    },
    {
      id: "email",
      label: "Email",
      href: "/admin/email/outbox",
      icon: Mail,
      requirement: EMAIL_OUTBOX_ACCESS,
    },
    {
      id: "saleroom",
      label: "Saleroom",
      href: "/admin/saleroom",
      icon: MonitorPlay,
      requirement: "auction.manage",
    },
    {
      id: "lot-fulfilment",
      label: "Fulfilment",
      href: "/admin/lot-fulfilment",
      icon: Truck,
      match: (pathname) => pathname.startsWith("/admin/lot-fulfilment"),
      requirement: "operations.fulfilment",
    },
    {
      id: "audit",
      label: "Audit",
      href: "/admin/audit/events",
      icon: FileText,
      match: (pathname) => pathname.startsWith("/admin/audit"),
      requirement: AUDIT_ACCESS,
    },
    {
      id: "system",
      label: "System",
      href: "/admin/settings/platform",
      icon: Settings,
      match: (pathname) => pathname.startsWith("/admin/settings"),
      requirement: "platform.admin.full",
    },
    {
      id: "cms",
      label: "CMS",
      href: "/admin/cms",
      icon: LayoutGrid,
      match: (pathname) => pathname.startsWith("/admin/cms"),
      requirement: CMS_ACCESS,
    },
    {
      id: "xero",
      label: "Xero",
      href: "/admin/integrations/xero",
      icon: Plug,
      requirement: "finance.read",
    },
  ];
}

/** Staff sidebar items filtered by the signed-in user's capabilities. */
export function getStaffNavItems(
  role: UserRole,
  staffRole: UserStaffRole | null | undefined,
  pendingSubmissionCount = 0,
): AppShellNavItem[] {
  return buildStaffNavSpecs(pendingSubmissionCount)
    .filter((spec) => userHasAccessTo(role, staffRole ?? null, spec.requirement))
    .map(({ requirement: _r, ...item }) => item);
}

export function getAppShellNavItems(
  shell: AppShellRole,
  sessionUser: Pick<SessionUser, "role" | "staffRole">,
  pendingSubmissionCount = 0,
  clientWorkspace: ClientWorkspaceMode = "buying",
): AppShellNavItem[] {
  if (shell === "client") return getClientNavItems(clientWorkspace);
  return getStaffNavItems(
    sessionUser.role as UserRole,
    sessionUser.staffRole ?? null,
    pendingSubmissionCount,
  );
}

export function getRouteLabel(
  pathname: string,
  shell: AppShellRole,
  clientWorkspace: ClientWorkspaceMode = "buying",
  sessionUser?: Pick<SessionUser, "role" | "staffRole"> | null,
): string {
  const navUser: Pick<SessionUser, "role" | "staffRole"> =
    shell === "client"
      ? { role: "client", staffRole: null }
      : (sessionUser ?? { role: "staff", staffRole: "super_admin" });
  const items = getAppShellNavItems(shell, navUser, 0, clientWorkspace);
  const active = items.find((item) =>
    item.match ? item.match(pathname) : exactOrNested(item.href)(pathname),
  );
  if (active) return active.label;
  if (pathname.includes("/new")) return "New";
  if (pathname.includes("/edit")) return "Edit";
  if (pathname.includes("/checkout")) return "Checkout";
  if (shell === "client" && pathname.startsWith("/dashboard/live")) return "Live sale";
  return "Detail";
}

export function getRouteParentLabel(
  pathname: string,
  shell: AppShellRole,
  clientWorkspace: ClientWorkspaceMode = "buying",
): string | null {
  if (shell === "client" && pathname.startsWith("/dashboard/settings")) return "Settings";
  if (shell === "client" && pathname.startsWith("/dashboard/checkout")) return "Collection";
  if (shell === "client" && pathname.startsWith("/dashboard/seller"))
    return clientWorkspace === "selling" ? "Selling" : null;
  if (shell === "client" && pathname.startsWith("/dashboard/live")) return "Live bidding";
  if (shell === "client" && pathname.startsWith("/dashboard/team")) return "Team";
  if (shell !== "client" && pathname.startsWith("/admin/lots/")) return "Lots";
  if (shell !== "client" && pathname.startsWith("/admin/sales/")) return "Sales";
  if (shell !== "client" && pathname.startsWith("/admin/categories/")) return "Categories";
  if (shell !== "client" && pathname.startsWith("/admin/artists/")) return "Artists";
  if (shell !== "client" && pathname.startsWith("/admin/submissions/")) return "Submissions";
  if (shell !== "client" && pathname.startsWith("/admin/conveyor")) return "Operations";
  if (shell !== "client" && pathname.startsWith("/admin/users/")) return "Users";
  if (shell !== "client" && pathname.startsWith("/admin/saleroom")) return "Saleroom";
  if (shell !== "client" && pathname.startsWith("/admin/audit")) return "Audit";
  if (shell !== "client" && pathname.startsWith("/admin/settings")) return "System";
  if (shell !== "client" && pathname.startsWith("/admin/cms")) return "CMS";
  if (shell !== "client" && pathname.startsWith("/admin/payouts")) return "Finance";
  if (shell !== "client" && pathname.startsWith("/admin/integrations")) return "Xero";
  return null;
}
