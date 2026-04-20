"use client";

import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { SessionUser } from "@/lib/data/contracts";
import { cn } from "@auction/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@auction/ui/components/dialog";
import Link from "next/link";
import { useEffect, useState } from "react";
import { accountNavLinks } from "./header-account-nav";
import { navItemActive, utilityNav } from "./header-nav-config";
import { HeaderSearch } from "./header-search";
import { LaxLogo } from "./lax-logo";
import { LogoutButton } from "./logout-button";
import { ThemeToggle } from "./theme-toggle";

type MobileNavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SessionUser | null;
  pathname: string;
  sections: MegaMenuSection[];
};

const drawerContentClass =
  "fixed inset-y-0 top-0 right-0 left-auto z-50 !flex h-full max-h-[100dvh] w-full max-w-sm translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-l border-nav-border bg-surface p-0 shadow-xl sm:max-w-sm sm:rounded-none";

export function MobileNavDrawer({
  open,
  onOpenChange,
  user,
  pathname,
  sections,
}: MobileNavDrawerProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const close = () => {
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) setExpandedIndex(null);
  }, [open]);

  useEffect(() => {
    void pathname;
    setExpandedIndex(null);
  }, [pathname]);

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
              {sections.map((section, index) => {
                const active = navItemActive(pathname, section.href);
                const expanded = expandedIndex === index;
                const panelId = `mobile-nav-section-${index}`;
                return (
                  <li
                    key={section.href}
                    className="border-b border-nav-border pb-2 last:border-b-0"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 py-2 text-left font-label text-sm font-medium uppercase tracking-wide focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => setExpandedIndex(expanded ? null : index)}
                    >
                      <span className={active ? "text-brand-900" : "text-nav-text"}>
                        {section.label}
                      </span>
                      <MaterialIcon
                        name="expand_more"
                        className={cn(
                          "shrink-0 text-brand-900 transition-transform motion-reduce:transition-none dark:text-on-surface",
                          expanded ? "rotate-180" : "rotate-0",
                        )}
                        aria-hidden
                      />
                    </button>
                    {expanded ? (
                      <div
                        id={panelId}
                        className="mt-1 flex flex-col gap-1 border-l border-nav-border pl-3"
                      >
                        {section.items.length > 0 ? (
                          <ul className="flex flex-col gap-1">
                            {section.items.map((row) => (
                              <li key={row.href}>
                                <Link
                                  href={row.href}
                                  className="block py-1.5 font-body text-sm text-brand-900 dark:text-on-surface"
                                  onClick={close}
                                >
                                  {row.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="py-1 font-body text-xs text-brand-400">
                            Nothing to show yet.
                          </p>
                        )}
                        <Link
                          href={section.viewAllHref ?? section.href}
                          className="py-2 font-label text-xs font-semibold uppercase tracking-wide text-brand-900 dark:text-on-surface"
                          onClick={close}
                        >
                          View all
                        </Link>
                      </div>
                    ) : null}
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

          <div className="flex flex-col gap-3 border-t border-nav-border pt-4">
            {user ? (
              <>
                <p className="font-label text-xs font-semibold uppercase tracking-wide text-brand-400">
                  Account
                </p>
                <div className="rounded-md border border-nav-border bg-page-bg px-3 py-2 dark:border-outline-variant/15 dark:bg-surface-container-low">
                  <p className="font-body text-sm font-medium text-brand-900 dark:text-on-surface">
                    {user.name.trim() || "Signed in"}
                  </p>
                  <p className="mt-0.5 truncate font-body text-xs text-brand-400 dark:text-on-surface-variant">
                    {user.email}
                  </p>
                </div>
                <ul className="flex flex-col gap-0.5">
                  {accountNavLinks(user).map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="block py-2 font-label text-sm font-medium uppercase tracking-wide text-brand-900 transition-colors hover:text-brand-800 dark:text-on-surface"
                        onClick={close}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <LogoutButton
                  onBeforeNavigate={close}
                  className="block w-full rounded-md border border-nav-border py-3 text-center font-label text-sm font-medium uppercase tracking-wide text-brand-900 transition-colors hover:bg-page-bg disabled:cursor-not-allowed disabled:opacity-50 dark:border-outline-variant/15 dark:text-on-surface dark:hover:bg-surface-container-low"
                />
              </>
            ) : (
              <Link
                href="/login"
                className="block w-full rounded-md border border-brand-900 bg-brand-900 py-3 text-center font-label text-sm font-medium uppercase tracking-wide text-surface transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold motion-reduce:transition-none dark:border-on-surface dark:bg-on-surface dark:text-brand-900 dark:hover:bg-brand-200"
                onClick={close}
              >
                Log in
              </Link>
            )}
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
