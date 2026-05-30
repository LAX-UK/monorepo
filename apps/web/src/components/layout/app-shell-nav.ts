import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import { getStaffNavItems, getStaffNavParentLabel } from "@/components/layout/staff-nav";
import type { SessionUser } from "@/lib/data/contracts";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import type { AppShellLayout, UserRole, UserStaffRole } from "@auction/types";
import { staffRoleToShellLayout } from "@auction/types";
import {
  Bell,
  Brush,
  Building2,
  CreditCard,
  Heart,
  Inbox,
  Layers,
  LayoutGrid,
  Menu,
  Package,
  Settings,
  Store,
  TrendingUp,
  Upload,
  WalletCards,
} from "lucide-react";

/** Visual shell segment for the dashboard chrome. */
export type AppShellRole = AppShellLayout;

/** Maps session user to shell layout (client vs platform admin vs finance). */
export function sessionUserToShellRole(
  user: Pick<SessionUser, "role" | "staffRole">,
): AppShellRole {
  return staffRoleToShellLayout(user.role as UserRole, user.staffRole ?? null);
}

export type { AppShellNavItem };

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

const ORG_MODULE_NAV_IDS = new Set(["organisations", "invitations"]);

function filterOrgModuleNavItems(
  items: AppShellNavItem[],
  orgModuleEnabled: boolean,
): AppShellNavItem[] {
  if (orgModuleEnabled) return items;
  return items.filter((item) => !ORG_MODULE_NAV_IDS.has(item.id));
}

/** Collector-focused navigation (bidding & collection). */
export function getClientBuyingNavItems(orgModuleEnabled = true): AppShellNavItem[] {
  return filterOrgModuleNavItems(
    [
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
      {
        id: "watchlist",
        label: "Watchlist",
        href: "/dashboard/watchlist",
        icon: Heart,
        match: (pathname) =>
          pathname.startsWith("/dashboard/watchlist") ||
          pathname.startsWith("/dashboard/artist-follow"),
      },
      {
        id: "organisations",
        label: "Organisations",
        href: "/dashboard/organisations",
        icon: Building2,
        match: exactOrNested("/dashboard/organisations"),
      },
      {
        id: "invitations",
        label: "Invitations",
        href: "/dashboard/invitations",
        icon: Inbox,
        match: exactOrNested("/dashboard/invitations"),
      },
      { id: "notifications", label: "Notifications", href: "/dashboard/notifications", icon: Bell },
      {
        id: "settings",
        label: "Settings",
        href: "/dashboard/settings/profile",
        icon: Settings,
        match: exactOrNested("/dashboard/settings"),
      },
    ],
    orgModuleEnabled,
  );
}

/** Seller & artist workspace navigation. */
export function getClientSellingNavItems(orgModuleEnabled = true): AppShellNavItem[] {
  return filterOrgModuleNavItems(
    [
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
        id: "organisations",
        label: "Organisations",
        href: "/dashboard/organisations",
        icon: Building2,
        match: exactOrNested("/dashboard/organisations"),
      },
      {
        id: "invitations",
        label: "Invitations",
        href: "/dashboard/invitations",
        icon: Inbox,
        match: exactOrNested("/dashboard/invitations"),
      },
      { id: "notifications", label: "Notifications", href: "/dashboard/notifications", icon: Bell },
      {
        id: "settings",
        label: "Settings",
        href: "/dashboard/settings/profile",
        icon: Settings,
        match: exactOrNested("/dashboard/settings"),
      },
    ],
    orgModuleEnabled,
  );
}

export function getClientNavItems(
  workspace: ClientWorkspaceMode = "buying",
  orgModuleEnabled = true,
): AppShellNavItem[] {
  return workspace === "selling"
    ? getClientSellingNavItems(orgModuleEnabled)
    : getClientBuyingNavItems(orgModuleEnabled);
}

export function getClientMobileBottomTabs(
  workspace: ClientWorkspaceMode = "buying",
  orgModuleEnabled = true,
): AppShellNavItem[] {
  const more = {
    id: "more",
    label: "More",
    href: "#more",
    icon: Menu,
  };
  if (workspace === "selling") {
    const selling = getClientSellingNavItems(orgModuleEnabled);
    return [
      selling.find((item) => item.id === "seller-overview"),
      selling.find((item) => item.id === "submissions"),
      selling.find((item) => item.id === "in-sale"),
      selling.find((item) => item.id === "notifications"),
      more,
    ].filter((item): item is AppShellNavItem => item != null);
  }
  const buying = getClientBuyingNavItems(orgModuleEnabled);
  return [
    buying.find((item) => item.id === "overview"),
    buying.find((item) => item.id === "bids"),
    buying.find((item) => item.id === "watchlist"),
    buying.find((item) => item.id === "notifications"),
    more,
  ].filter((item): item is AppShellNavItem => item != null);
}

export { getStaffNavItems };

export function getAppShellNavItems(
  shell: AppShellRole,
  sessionUser: Pick<SessionUser, "role" | "staffRole">,
  pendingSubmissionCount = 0,
  clientWorkspace: ClientWorkspaceMode = "buying",
  pendingArtistCount = 0,
  navCounts?: import("@/lib/data/http/admin-nav-counts.types").AdminNavCounts,
  orgModuleEnabled = true,
): AppShellNavItem[] {
  if (shell === "client") return getClientNavItems(clientWorkspace, orgModuleEnabled);
  return getStaffNavItems(
    sessionUser.role as UserRole,
    sessionUser.staffRole ?? null,
    pendingSubmissionCount,
    pendingArtistCount,
    navCounts,
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
  if (shell === "client" && pathname.startsWith("/dashboard/organisations")) return "Organisations";
  if (shell === "client" && pathname.startsWith("/dashboard/invitations")) return "Invitations";
  return "Detail";
}

export function getRouteParentLabel(
  pathname: string,
  shell: AppShellRole,
  clientWorkspace: ClientWorkspaceMode = "buying",
  sessionUser?: Pick<SessionUser, "role" | "staffRole"> | null,
): string | null {
  if (shell === "client" && pathname.startsWith("/dashboard/settings")) return "Settings";
  if (shell === "client" && pathname.startsWith("/dashboard/checkout")) return "Collection";
  if (shell === "client" && pathname.startsWith("/dashboard/seller"))
    return clientWorkspace === "selling" ? "Selling" : null;
  if (shell === "client" && pathname.startsWith("/dashboard/organisations")) return "Organisations";
  if (shell === "client" && pathname.startsWith("/dashboard/invitations")) return "Invitations";
  if (shell !== "client" && pathname.startsWith("/admin")) {
    const u = sessionUser ?? {
      role: "staff" as UserRole,
      staffRole: "super_admin" as UserStaffRole,
    };
    return getStaffNavParentLabel(pathname, u.role as UserRole, u.staffRole ?? null, 0);
  }
  return null;
}
