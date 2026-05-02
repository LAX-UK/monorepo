import type { NavGroup } from "@/lib/navigation/nav-types";
import { Bell, Gavel, Heart, LayoutDashboard, Palette, Store, User } from "lucide-react";

export const dashboardNavGroups: readonly NavGroup[] = [
  {
    title: "Bidding",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/bids", label: "Bids", icon: Gavel },
      { href: "/dashboard/portfolio", label: "Collection", icon: Palette },
      { href: "/dashboard/submissions", label: "Submissions", icon: Store },
      { href: "/dashboard/watchlist", label: "Watchlist", icon: Heart },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/dashboard/settings/profile", label: "Settings", icon: User }],
  },
] as const;
