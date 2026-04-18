"use client";

import { useShellContext } from "@/components/layout/dashboard-shell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MaterialIcon } from "@/components/ui/material-icon";
import { SITE_SHORT_NAME } from "@/lib/brand";
import type { SessionUser } from "@/lib/data/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Overview", icon: "dashboard" },
  { href: "/dashboard/submissions", label: "Sell an item", icon: "storefront" },
  { href: "/dashboard/bids", label: "Active Bids", icon: "gavel" },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: "palette" },
  { href: "/dashboard/notifications", label: "Notifications", icon: "notifications" },
  { href: "/dashboard/settings/profile", label: "Profile", icon: "person" },
  { href: "/dashboard/settings/notifications", label: "Alert settings", icon: "tune" },
] as const;

const adminLink = { href: "/admin", label: "Admin panel", icon: "shield_person" } as const;

type Props = {
  user: SessionUser;
};

export function DashboardSidebar({ user }: Props) {
  const { onNavigate, mobileOpen } = useShellContext();
  const pathname = usePathname();
  const onNav = onNavigate;

  const asideTransform = mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0";

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-outline-variant/15 bg-surface-container-lowest shadow-[4px_0_24px_rgba(0,0,0,0.06)] transition-transform duration-200 ease-out ${asideTransform}`}
    >
      <div className="p-8">
        <Link
          href="/"
          onClick={onNav}
          className="mb-12 block font-headline text-xl tracking-tighter text-on-surface"
        >
          {SITE_SHORT_NAME}
        </Link>
        <p className="mb-2 font-label text-xs uppercase tracking-widest text-secondary">
          Signed in
        </p>
        <p className="font-body text-sm font-medium text-on-surface">{user.name}</p>
        <p className="mt-1 truncate font-body text-xs text-on-surface-variant">{user.email}</p>
        <nav className="mt-12 space-y-1" aria-label="Dashboard">
          {links.map((l) => {
            const active =
              l.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={onNav}
                aria-current={active ? "page" : undefined}
                className={`flex items-center border-l-4 px-4 py-3 text-xs font-medium uppercase tracking-widest transition-all ${
                  active
                    ? "border-primary bg-surface-container-low text-on-surface"
                    : "border-transparent text-on-surface hover:bg-surface-container-low/80"
                }`}
              >
                <MaterialIcon name={l.icon} className="mr-3 text-lg" />
                {l.label}
              </Link>
            );
          })}
          {user.role === "admin" ? (
            <Link
              key={adminLink.href}
              href={adminLink.href}
              onClick={onNav}
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              className={`flex items-center border-l-4 px-4 py-3 text-xs font-medium uppercase tracking-widest transition-all ${
                pathname.startsWith("/admin")
                  ? "border-primary bg-surface-container-low text-on-surface"
                  : "border-transparent text-on-surface hover:bg-surface-container-low/80"
              }`}
            >
              <MaterialIcon name={adminLink.icon} className="mr-3 text-lg" />
              {adminLink.label}
            </Link>
          ) : null}
        </nav>
      </div>
      <div className="mt-auto space-y-4 p-8">
        <div className="flex items-center gap-3">
          <span className="font-label text-xs uppercase tracking-widest text-secondary">Theme</span>
          <ThemeToggle />
        </div>
        <Link
          href="/"
          onClick={onNav}
          className="block font-label text-xs uppercase tracking-widest text-primary transition-colors hover:underline"
        >
          Exit to gallery
        </Link>
      </div>
    </aside>
  );
}
