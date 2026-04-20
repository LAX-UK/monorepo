"use client";

import type { SessionUser } from "@/lib/data/contracts";
import { cn } from "@auction/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@auction/ui/components/dialog";
import Link from "next/link";
import { HeaderAuthLinks } from "./header-auth-links";
import { navItemActive, primaryNav, utilityNav } from "./header-nav-config";
import { HeaderSearch } from "./header-search";
import { LaxLogo } from "./lax-logo";
import { LogoutButton } from "./logout-button";
import { ThemeToggle } from "./theme-toggle";

type MobileNavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SessionUser | null;
  pathname: string;
};

const drawerContentClass =
  "fixed inset-y-0 top-0 right-0 left-auto z-50 !flex h-full max-h-[100dvh] w-full max-w-sm translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-l border-nav-border bg-surface p-0 shadow-xl sm:max-w-sm sm:rounded-none";

export function MobileNavDrawer({ open, onOpenChange, user, pathname }: MobileNavDrawerProps) {
  const close = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("border-outline-variant/20 p-0 sm:p-0", drawerContentClass)}>
        <DialogTitle className="sr-only">Site navigation</DialogTitle>
        <DialogDescription className="sr-only">
          Main menu, search, account links, and theme
        </DialogDescription>

        <div className="flex flex-col gap-6 px-6 py-6">
          <div className="flex items-center justify-between border-b border-nav-border pb-4">
            <Link
              href="/"
              className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold"
              onClick={close}
            >
              <LaxLogo variant="header" />
            </Link>
          </div>

          <HeaderSearch variant="mobile" inputId="mobile-nav-search" />

          <nav aria-label="Mobile primary">
            <ul className="flex flex-col gap-1">
              {primaryNav.map((item) => {
                const active = navItemActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block py-2 font-label text-sm font-medium uppercase tracking-wide ${
                        active ? "text-brand-900" : "text-nav-text"
                      }`}
                      aria-current={active ? "page" : undefined}
                      onClick={close}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <ul className="flex flex-col gap-1 border-t border-nav-border pt-4">
            {utilityNav.map((item) => (
              <li key={`drawer-${item.label}`}>
                <Link
                  href={item.href}
                  className="block py-2 font-label text-sm font-medium uppercase tracking-wide text-brand-900"
                  onClick={close}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 border-t border-nav-border pt-4">
            <HeaderAuthLinks user={user} variant="drawer" onNavigate={close} />
            {user ? (
              <LogoutButton
                onBeforeNavigate={close}
                className="block w-full py-2 text-left font-label text-sm font-medium uppercase tracking-wide text-brand-900 transition-colors hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              />
            ) : null}
          </div>

          <div className="flex items-center gap-3 border-t border-nav-border pt-4">
            <span className="font-label text-xs font-semibold uppercase text-brand-400">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
