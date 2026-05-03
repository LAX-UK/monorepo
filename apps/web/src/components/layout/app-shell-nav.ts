import {
  BarChart3,
  Bell,
  CreditCard,
  Gauge,
  Heart,
  LayoutGrid,
  Mail,
  Package,
  ScrollText,
  Settings,
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

export function getClientNavItems(): AppShellNavItem[] {
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
    { id: "submissions", label: "Submissions", href: "/dashboard/submissions", icon: Upload },
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
    {
      id: "submissions",
      label: "Submissions",
      href: "/admin/submissions",
      icon: Upload,
      ...(pendingSubmissionCount > 0 ? { badge: pendingSubmissionCount } : {}),
    },
    { id: "users", label: "Users", href: "/admin/users", icon: Users },
    { id: "analytics", label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    { id: "invitations", label: "Invitations", href: "/admin/invitations", icon: Mail },
  ];
}

export function getAccountantNavItems(): AppShellNavItem[] {
  return [
    { id: "payments", label: "Payments", href: "/admin/payments", icon: WalletCards },
    { id: "xero", label: "Xero", href: "/admin/integrations/xero", icon: CreditCard },
  ];
}

export function getAppShellNavItems(role: AppShellRole, pendingSubmissionCount = 0) {
  if (role === "client") return getClientNavItems();
  if (role === "accountant") return getAccountantNavItems();
  return getAdminNavItems(pendingSubmissionCount);
}

export function getRouteLabel(pathname: string, role: AppShellRole): string {
  const items = getAppShellNavItems(role);
  const active = items.find((item) =>
    item.match ? item.match(pathname) : exactOrNested(item.href)(pathname),
  );
  if (active) return active.label;
  if (pathname.includes("/new")) return "New";
  if (pathname.includes("/edit")) return "Edit";
  if (pathname.includes("/checkout")) return "Checkout";
  return "Detail";
}

export function getRouteParentLabel(pathname: string, role: AppShellRole): string | null {
  if (role === "client" && pathname.startsWith("/dashboard/settings")) return "Settings";
  if (role === "client" && pathname.startsWith("/dashboard/checkout")) return "Collection";
  if (role === "admin" && pathname.startsWith("/admin/lots/")) return "Lots";
  if (role === "admin" && pathname.startsWith("/admin/sales/")) return "Sales";
  if (role === "admin" && pathname.startsWith("/admin/submissions/")) return "Submissions";
  if (role === "accountant" && pathname.startsWith("/admin/integrations")) return "Xero";
  return null;
}
