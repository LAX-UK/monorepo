"use client";

import type { SessionUser } from "@/lib/data/contracts";
import {
  type UserRole,
  canAccessFinanceAdminRoutes,
  canAccessPlatformAdminRoutes,
} from "@auction/types";
import { cn } from "@auction/ui";
import { Building2, CreditCard, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type WorkspaceLink = {
  id: "platform" | "finance" | "gallery";
  label: string;
  href: string;
  icon: typeof Building2;
  active: boolean;
};

type Props = {
  user: SessionUser;
  collapsed?: boolean;
};

/** Switch between platform admin, finance admin, and public gallery. */
export function StaffWorkspaceSwitcher({ user, collapsed = false }: Props) {
  const pathname = usePathname();
  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;

  const links: WorkspaceLink[] = [];
  if (canAccessPlatformAdminRoutes(role, staffRole)) {
    links.push({
      id: "platform",
      label: "Platform",
      href: "/admin",
      icon: Building2,
      active:
        pathname.startsWith("/admin") &&
        !pathname.startsWith("/admin/payments") &&
        !pathname.startsWith("/admin/payouts") &&
        !pathname.startsWith("/admin/disputes") &&
        !pathname.startsWith("/admin/integrations"),
    });
  }
  if (canAccessFinanceAdminRoutes(role, staffRole)) {
    links.push({
      id: "finance",
      label: "Finance",
      href: "/admin/payments",
      icon: CreditCard,
      active:
        pathname.startsWith("/admin/payments") ||
        pathname.startsWith("/admin/payouts") ||
        pathname.startsWith("/admin/disputes") ||
        pathname.startsWith("/admin/integrations"),
    });
  }
  links.push({
    id: "gallery",
    label: "Gallery",
    href: "/",
    icon: Store,
    active: !pathname.startsWith("/admin"),
  });

  if (links.length <= 1) return null;

  return (
    <nav aria-label="Workspace" className={cn("space-y-1", collapsed && "px-1")}>
      {!collapsed ? (
        <p className="px-3 pb-1 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
          Workspace
        </p>
      ) : null}
      <ul className="space-y-0.5">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <li key={link.id}>
              <Link
                href={link.href}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-md px-3 py-2 font-label text-xs transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  link.active
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                  collapsed && "justify-center px-2",
                )}
                title={collapsed ? link.label : undefined}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {!collapsed ? <span>{link.label}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
