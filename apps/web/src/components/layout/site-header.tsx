"use client";

import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { emptyMegaMenuSections } from "@/components/layout/header-nav-config";
import type { SessionUser } from "@/lib/data/contracts";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HeaderAuthLinks } from "./header-auth-links";
import { HeaderMegaNav } from "./header-mega-nav";
import { HeaderSearchTrigger } from "./header-search";
import { HeaderUtilityBar } from "./header-utility-bar";
import { LaxLogo } from "./lax-logo";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";

type SiteHeaderProps = {
  user: SessionUser | null;
  nav?: MegaMenuSection[];
};

export function SiteHeader({ user, nav: navProp }: SiteHeaderProps) {
  const nav = navProp ?? emptyMegaMenuSections();
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: close mobile menu when the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full bg-surface transition-colors",
        megaOpen ? "border-b border-transparent" : "border-b border-nav-border",
      )}
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-3 md:px-10">
        <div className="hidden lg:block">
          <HeaderUtilityBar user={user} />
        </div>

        <HeaderMegaNav
          sections={nav}
          pathname={pathname}
          onOpenChange={setMegaOpen}
          logo={
            <Link
              href="/"
              className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold"
            >
              <LaxLogo variant="header" />
            </Link>
          }
          trailing={
            <div className="flex min-w-0 flex-1 items-center justify-end gap-3 lg:max-w-[420px] lg:flex-none">
              <HeaderSearchTrigger />
              <ThemeToggle />
              {user ? <NotificationBell /> : null}
              <div className="lg:hidden">
                <HeaderAuthLinks user={user} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] text-brand-800 hover:bg-page-bg lg:hidden dark:text-on-surface"
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                onClick={() => setMenuOpen((o) => !o)}
              >
                {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
              </Button>
            </div>
          }
        />
      </div>

      <MobileNavDrawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        user={user}
        pathname={pathname}
        sections={nav}
      />
    </header>
  );
}
