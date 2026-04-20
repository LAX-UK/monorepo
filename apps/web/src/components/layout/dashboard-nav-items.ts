import type { NavItem } from "@/lib/navigation/nav-types";

export const dashboardNavItems: readonly NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "dashboard" },
  { href: "/dashboard/submissions", label: "Sell an item", icon: "storefront" },
  { href: "/dashboard/bids", label: "Active Bids", icon: "gavel" },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: "palette" },
  { href: "/dashboard/notifications", label: "Notifications", icon: "notifications" },
  { href: "/dashboard/settings/profile", label: "Profile", icon: "person" },
  { href: "/dashboard/settings/notifications", label: "Alert settings", icon: "tune" },
] as const;
