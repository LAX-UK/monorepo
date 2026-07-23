"use client";

import { sidebarNavItemClassName } from "@/lib/layout/sidebar-nav-classes";
import { cn } from "@auction/ui";
import { Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  collapsed?: boolean;
};

const FINANCE_ADMIN_PREFIXES = [
  "/admin/finance",
  "/admin/payments",
  "/admin/payouts",
  "/admin/disputes",
  "/admin/integrations",
] as const;

export function isFinanceAdminPath(pathname: string): boolean {
  return FINANCE_ADMIN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isPlatformAdminPath(pathname: string): boolean {
  return pathname === "/admin" || (pathname.startsWith("/admin/") && !isFinanceAdminPath(pathname));
}

/** Link back to the public gallery from the staff shell footer. */
export function StaffWorkspaceSwitcher({ collapsed = false }: Props) {
  const pathname = usePathname();
  const active = !pathname.startsWith("/admin");

  return (
    <nav aria-label="Gallery" className={cn(collapsed && "px-0.5")}>
      <Link
        href="/"
        className={cn(
          sidebarNavItemClassName({ active, labelsHidden: collapsed }),
          "text-xs",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )}
        title={collapsed ? "Gallery" : undefined}
        aria-current={active ? "page" : undefined}
      >
        <Store className="size-4 shrink-0" aria-hidden />
        {!collapsed ? <span className="min-w-0 flex-1 truncate">Gallery</span> : null}
      </Link>
    </nav>
  );
}
