"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import type { SessionUser } from "@/lib/data/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HeaderPrimaryNav } from "./header-primary-nav";
import { HeaderSearch } from "./header-search";
import { HeaderUtilityBar } from "./header-utility-bar";
import { LaxLogo } from "./lax-logo";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({ user }: { user: SessionUser | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    void pathname;
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="fixed top-0 z-50 w-full border-b border-nav-border bg-surface">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-3 md:px-10">
        <HeaderUtilityBar user={user} />

        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold"
          >
            <LaxLogo variant="header" />
          </Link>

          <HeaderPrimaryNav pathname={pathname} />

          <div className="flex min-w-0 flex-1 items-center justify-end gap-3 lg:max-w-[320px] lg:flex-none">
            <HeaderSearch variant="desktop" />
            <ThemeToggle />
            <NotificationBell />
            <button
              type="button"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-brand-800 transition-colors hover:bg-page-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold lg:hidden dark:text-on-surface"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MaterialIcon name={menuOpen ? "close" : "menu"} />
            </button>
          </div>
        </div>
      </div>

      <MobileNavDrawer open={menuOpen} onOpenChange={setMenuOpen} user={user} pathname={pathname} />
    </header>
  );
}
