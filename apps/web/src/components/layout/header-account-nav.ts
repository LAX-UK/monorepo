import type { SessionUser } from "@/lib/data/contracts";
import {
  type UserRole,
  canAccessFinanceAdminRoutes,
  canAccessPlatformAdminRoutes,
} from "@auction/types";

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
  const role = user.role as UserRole;
  const staff = user.staffRole ?? null;
  if (canAccessPlatformAdminRoutes(role, staff)) {
    out.push({ href: "/admin", label: "Admin panel" });
  } else if (canAccessFinanceAdminRoutes(role, staff)) {
    out.push({ href: "/admin/payments", label: "Finance admin" });
  }
  return out;
}
