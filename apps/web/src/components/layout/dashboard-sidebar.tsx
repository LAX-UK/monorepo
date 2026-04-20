"use client";

import { dashboardNavItems } from "@/components/layout/dashboard-nav-items";
import { useShellContext } from "@/components/layout/dashboard-shell";
import { LogoutButton } from "@/components/layout/logout-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MaterialIcon } from "@/components/ui/material-icon";
import { useIsLg } from "@/hooks/use-is-lg";
import { SITE_SHORT_NAME } from "@/lib/brand";
import type { SessionUser } from "@/lib/data/contracts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@auction/ui/components/sheet";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  user: SessionUser;
};

function DashboardNavBody({ user, onNav }: { user: SessionUser; onNav: () => void }) {
  const pathname = usePathname();
  return (
    <>
      <div className="p-8">
        <Link
          href="/"
          onClick={onNav}
          className="mb-12 block font-headline text-xl tracking-tighter text-on-surface"
        >
          {SITE_SHORT_NAME}
        </Link>
        <p className="mb-2 font-label text-xs uppercase tracking-widest text-secondary">Signed in</p>
        <p className="font-body text-sm font-medium text-on-surface">{user.name}</p>
        <p className="mt-1 truncate font-body text-xs text-on-surface-variant">{user.email}</p>
        <nav className="mt-12 space-y-1" aria-label="Dashboard">
          {dashboardNavItems.map((l) => {
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
        </nav>
      </div>
      <div className="mt-auto space-y-4 p-8">
        <div className="flex items-center gap-3">
          <span className="font-label text-xs uppercase tracking-widest text-secondary">Theme</span>
          <ThemeToggle />
        </div>
        <LogoutButton onBeforeNavigate={onNav} />
        <Link
          href="/"
          onClick={onNav}
          className="block font-label text-xs uppercase tracking-widest text-primary transition-colors hover:underline"
        >
          Exit to gallery
        </Link>
      </div>
    </>
  );
}

export function DashboardSidebar({ user }: Props) {
  const { onNavigate, mobileOpen, setMobileOpen } = useShellContext();
  const isLg = useIsLg();
  const onNav = onNavigate;

  const body = <DashboardNavBody user={user} onNav={onNav} />;

  return (
    <>
      {isLg ? (
        <aside className="fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-outline-variant/15 bg-surface-container-lowest shadow-[4px_0_24px_rgba(0,0,0,0.06)]">
          {body}
        </aside>
      ) : (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="flex w-[min(100vw-2rem,20rem)] max-w-none flex-col border-outline-variant/15 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Dashboard navigation</SheetTitle>
            </SheetHeader>
            <div className="flex h-full flex-col overflow-y-auto">{body}</div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
