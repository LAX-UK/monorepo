import type { NavGroup } from "@/lib/navigation/nav-types";
import {
  Bell,
  Gavel,
  LayoutDashboard,
  Palette,
  SlidersHorizontal,
  Store,
  User,
} from "lucide-react";

export const dashboardNavGroups: readonly NavGroup[] = [
  {
    title: "Bidding",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/bids", label: "Active Bids", icon: Gavel },
      { href: "/dashboard/portfolio", label: "Portfolio", icon: Palette },
      { href: "/dashboard/artist-follow", label: "Artists", icon: User },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "Selling",
    items: [{ href: "/dashboard/submissions", label: "Sell an item", icon: Store }],
  },
  {
    title: "Account",
    items: [
      { href: "/dashboard/settings/profile", label: "Profile", icon: User },
      {
        href: "/dashboard/settings/notifications",
        label: "Alert settings",
        icon: SlidersHorizontal,
      },
    ],
  },
] as const;
