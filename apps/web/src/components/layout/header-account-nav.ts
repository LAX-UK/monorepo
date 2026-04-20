import type { SessionUser } from "@/lib/data/contracts";

export type AccountNavLink = { href: string; label: string };

const BASE: AccountNavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/portfolio", label: "Portfolio" },
  { href: "/dashboard/submissions", label: "Sell an item" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/settings/profile", label: "Settings" },
];

export function accountNavLinks(user: SessionUser): AccountNavLink[] {
  const out = [...BASE];
  if (user.role === "admin") {
    out.push({ href: "/admin", label: "Admin panel" });
  }
  return out;
}
