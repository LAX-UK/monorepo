import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import {
  BarChart3,
  Bell,
  Building2,
  Brush,
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
  ScrollText,
  Settings,
  Store,
  TrendingUp,
  Upload,
  Users,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AppShellRole = "client" | "admin" | "accountant";

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
  admin: {
    label: "Administrator",
    workspaceLabel: "Admin",
    dotClassName: "bg-blue-500",
    pillClassName: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  accountant: {
    label: "Accountant",
    workspaceLabel: "Accountant",
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

export function getAdminNavItems(pendingSubmissionCount = 0): AppShellNavItem[] {
  return [
    {
      id: "overview",
      label: "Operations",
      href: "/admin",
      icon: Gauge,
      match: (pathname) => pathname === "/admin",
    },
    { id: "lots", label: "Lots", href: "/admin/lots", icon: Package },
    { id: "sales", label: "Sales", href: "/admin/sales", icon: ScrollText },
    { id: "categories", label: "Categories", href: "/admin/categories", icon: ListTree },
    { id: "artists", label: "Artists", href: "/admin/artists", icon: Brush },
    {
      id: "submissions",
      label: "Submissions",
      href: "/admin/submissions",
      icon: Upload,
      ...(pendingSubmissionCount > 0 ? { badge: pendingSubmissionCount } : {}),
    },
    { id: "users", label: "Users", href: "/admin/users", icon: Users },
    {
      id: "impersonation",
      label: "Impersonate",
      href: "/admin/impersonation",
      icon: MonitorSmartphone,
    },
    {
      id: "legal-entities",
      label: "Legal entities",
      href: "/admin/legal-entities",
      icon: Building2,
      match: (pathname) => pathname.startsWith("/admin/legal-entities"),
    },
    { id: "analytics", label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    { id: "payouts", label: "Payouts", href: "/admin/payouts", icon: WalletCards },
    { id: "invitations", label: "Invitations", href: "/admin/invitations", icon: Mail },
    { id: "email", label: "Email", href: "/admin/email/outbox", icon: Mail },
    { id: "saleroom", label: "Saleroom", href: "/admin/saleroom", icon: MonitorPlay },
    {
      id: "audit",
      label: "Audit",
      href: "/admin/audit/events",
      icon: FileText,
      match: (pathname) => pathname.startsWith("/admin/audit"),
    },
    {
      id: "system",
      label: "System",
      href: "/admin/settings/platform",
      icon: Settings,
      match: (pathname) => pathname.startsWith("/admin/settings"),
    },
    {
      id: "cms",
      label: "CMS",
      href: "/admin/cms",
      icon: LayoutGrid,
      match: (pathname) => pathname.startsWith("/admin/cms"),
    },
  ];
}

export function getAccountantNavItems(): AppShellNavItem[] {
  return [
    { id: "payments", label: "Payments", href: "/admin/payments", icon: WalletCards },
    { id: "payouts", label: "Payouts", href: "/admin/payouts", icon: WalletCards },
    { id: "xero", label: "Xero", href: "/admin/integrations/xero", icon: CreditCard },
  ];
}

export function getAppShellNavItems(
  role: AppShellRole,
  pendingSubmissionCount = 0,
  clientWorkspace: ClientWorkspaceMode = "buying",
) {
  if (role === "client") return getClientNavItems(clientWorkspace);
  if (role === "accountant") return getAccountantNavItems();
  return getAdminNavItems(pendingSubmissionCount);
}

export function getRouteLabel(
  pathname: string,
  role: AppShellRole,
  clientWorkspace: ClientWorkspaceMode = "buying",
): string {
  const items = getAppShellNavItems(role, 0, clientWorkspace);
  const active = items.find((item) =>
    item.match ? item.match(pathname) : exactOrNested(item.href)(pathname),
  );
  if (active) return active.label;
  if (pathname.includes("/new")) return "New";
  if (pathname.includes("/edit")) return "Edit";
  if (pathname.includes("/checkout")) return "Checkout";
  if (role === "client" && pathname.startsWith("/dashboard/live")) return "Live sale";
  return "Detail";
}

export function getRouteParentLabel(
  pathname: string,
  role: AppShellRole,
  clientWorkspace: ClientWorkspaceMode = "buying",
): string | null {
  if (role === "client" && pathname.startsWith("/dashboard/settings")) return "Settings";
  if (role === "client" && pathname.startsWith("/dashboard/checkout")) return "Collection";
  if (role === "client" && pathname.startsWith("/dashboard/seller"))
    return clientWorkspace === "selling" ? "Selling" : null;
  if (role === "client" && pathname.startsWith("/dashboard/live")) return "Live bidding";
  if (role === "client" && pathname.startsWith("/dashboard/team")) return "Team";
  if (role === "admin" && pathname.startsWith("/admin/lots/")) return "Lots";
  if (role === "admin" && pathname.startsWith("/admin/sales/")) return "Sales";
  if (role === "admin" && pathname.startsWith("/admin/categories/")) return "Categories";
  if (role === "admin" && pathname.startsWith("/admin/artists/")) return "Artists";
  if (role === "admin" && pathname.startsWith("/admin/submissions/")) return "Submissions";
  if (role === "admin" && pathname.startsWith("/admin/users/")) return "Users";
  if (role === "admin" && pathname.startsWith("/admin/saleroom")) return "Saleroom";
  if (role === "admin" && pathname.startsWith("/admin/audit")) return "Audit";
  if (role === "admin" && pathname.startsWith("/admin/settings")) return "System";
  if (role === "admin" && pathname.startsWith("/admin/cms")) return "CMS";
  if (role === "admin" && pathname.startsWith("/admin/payouts")) return "Finance";
  if (role === "accountant" && pathname.startsWith("/admin/payouts")) return "Finance";
  if (role === "accountant" && pathname.startsWith("/admin/integrations")) return "Xero";
  return null;
}
