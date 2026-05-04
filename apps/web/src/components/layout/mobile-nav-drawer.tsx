"use client";

import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MobileAuthSection } from "./header-auth-chip";
import { navItemActive, utilityNav } from "./header-nav-config";
import { HeaderSearchForm } from "./header-search";
import { LaxLogo } from "./lax-logo";
import { ThemeToggle } from "./theme-toggle";

type MobileNavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  sections: MegaMenuSection[];
};

const drawerContentClass =
  "fixed inset-y-0 top-0 right-0 left-auto z-50 !flex h-full max-h-[100dvh] w-full max-w-sm translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-l border-nav-border bg-surface p-0 shadow-xl sm:max-w-sm sm:rounded-none";

export function MobileNavDrawer({ open, onOpenChange, pathname, sections }: MobileNavDrawerProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const close = () => {
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) setExpandedIndex(null);
  }, [open]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset expanded sections when the route changes
  useEffect(() => {
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

          <HeaderSearchForm inputId="mobile-nav-search" />

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
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-between gap-2 rounded-none px-0 py-2 text-left font-label text-sm font-medium uppercase tracking-wide hover:bg-transparent"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => setExpandedIndex(expanded ? null : index)}
                    >
                      <span className={active ? "text-brand-900" : "text-nav-text"}>
                        {section.label}
                      </span>
                      <ChevronDown
                        className={cn(
                          "shrink-0 text-brand-900 transition-transform motion-reduce:transition-none dark:text-on-surface",
                          expanded ? "rotate-180" : "rotate-0",
                        )}
                        aria-hidden
                      />
                    </Button>
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

          <MobileAuthSection onNavigate={close} />

          <div className="flex items-center gap-3 border-t border-nav-border pt-4">
            <span className="font-label text-xs font-semibold uppercase text-brand-400">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
