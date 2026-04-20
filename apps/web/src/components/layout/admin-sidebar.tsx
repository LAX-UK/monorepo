"use client";

import { useShellContext } from "@/components/layout/dashboard-shell";
import { LogoutButton } from "@/components/layout/logout-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { SessionUser } from "@/lib/data/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Overview", icon: "dashboard" },
  { href: "/admin/analytics", label: "Analytics", icon: "bar_chart" },
  { href: "/admin/sales", label: "Sales", icon: "event" },
  {
    href: "/admin/submissions",
    label: "Submissions",
    icon: "assignment",
    badgeKey: "submissions" as const,
  },
  { href: "/admin/lots", label: "Lots", icon: "gavel" },
  { href: "/admin/payments", label: "Payments", icon: "account_balance_wallet" },
  { href: "/admin/users", label: "Users", icon: "group" },
] as const;

type Props = {
  user: SessionUser;
  pendingSubmissionCount?: number;
};

export function AdminSidebar({ user, pendingSubmissionCount = 0 }: Props) {
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
          href="/admin"
          onClick={onNav}
          className="mb-12 block font-headline text-xl tracking-tighter text-on-surface"
        >
          Admin
        </Link>
        <p className="mb-2 font-label text-xs uppercase tracking-widest text-secondary">
          Signed in
        </p>
        <p className="font-body text-sm font-medium text-on-surface">{user.name}</p>
        <p className="mt-1 truncate font-body text-xs text-on-surface-variant">{user.email}</p>
        <nav className="mt-12 space-y-1" aria-label="Admin">
          {links.map((l) => {
            const active =
              l.href === "/admin"
                ? pathname === "/admin"
                : pathname === l.href || pathname.startsWith(`${l.href}/`);
            const badge =
              "badgeKey" in l && l.badgeKey === "submissions" && pendingSubmissionCount > 0
                ? pendingSubmissionCount
                : null;
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
                <span className="flex flex-1 items-center justify-between gap-2">
                  <span>{l.label}</span>
                  {badge != null ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 font-label text-[10px] text-on-primary">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto space-y-4 p-8">
        <div className="flex items-center gap-3">
          <span className="font-label text-xs uppercase tracking-widest text-secondary">Theme</span>
          <ThemeToggle />
        </div>
        <Link
          href="/dashboard"
          onClick={onNav}
          className="block font-label text-xs uppercase tracking-widest text-primary transition-colors hover:underline"
        >
          Collector dashboard
        </Link>
        <LogoutButton onBeforeNavigate={onNav} />
        <Link
          href="/"
          onClick={onNav}
          className="block font-label text-xs uppercase tracking-widest text-secondary transition-colors hover:underline"
        >
          Exit to gallery
        </Link>
      </div>
    </aside>
  );
}
