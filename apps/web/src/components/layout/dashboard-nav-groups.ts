import type { NavGroup } from "@/lib/navigation/nav-types";

export const dashboardNavGroups: readonly NavGroup[] = [
  {
    title: "Bidding",
    items: [
      { href: "/dashboard", label: "Overview", icon: "dashboard" },
      { href: "/dashboard/bids", label: "Active Bids", icon: "gavel" },
      { href: "/dashboard/portfolio", label: "Portfolio", icon: "palette" },
      { href: "/dashboard/notifications", label: "Notifications", icon: "notifications" },
    ],
  },
  {
    title: "Selling",
    items: [{ href: "/dashboard/submissions", label: "Sell an item", icon: "storefront" }],
  },
  {
    title: "Account",
    items: [
      { href: "/dashboard/settings/profile", label: "Profile", icon: "person" },
      { href: "/dashboard/settings/notifications", label: "Alert settings", icon: "tune" },
    ],
  },
] as const;
