"use client";

import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@auction/ui/components/dialog";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { MarketingChevronDownIcon, MarketingCloseIcon } from "../marketing-icons.js";
import type { MarketingMegaNavSection } from "./marketing-header-mega-nav.js";

const drawerContentClass =
  "fixed inset-y-0 top-0 right-0 left-auto z-[var(--z-overlay,60)] !flex h-full max-h-[100dvh] w-[min(100vw-3rem,24rem)] max-w-sm translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-l border-nav-border bg-surface p-0 shadow-xl sm:max-w-sm sm:rounded-none";

export type MarketingMobileNavUtilityLink = { href: string; label: string };

export type MarketingMobileNavDrawerProps<TSection extends MarketingMegaNavSection> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resetKey: string;
  logo: ReactNode;
  sections: readonly TSection[];
  isSectionActive: (section: TSection) => boolean;
  isLinkCurrent?: (href: string) => boolean;
  topSlot?: ReactNode;
  themeSlot?: ReactNode;
  utilityLinks?: readonly MarketingMobileNavUtilityLink[];
  footerSlot?: ReactNode;
};

export function MarketingMobileNavDrawer<TSection extends MarketingMegaNavSection>({
  open,
  onOpenChange,
  resetKey,
  logo,
  sections,
  isSectionActive,
  isLinkCurrent,
  topSlot,
  themeSlot,
  utilityLinks,
  footerSlot,
}: MarketingMobileNavDrawerProps<TSection>) {
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
  }, [resetKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[var(--z-overlay,60)]"
        closeClassName="hidden"
        className={cn("border-border-hairline p-0 sm:p-0", drawerContentClass)}
      >
        <DialogTitle className="sr-only">Site navigation</DialogTitle>
        <DialogDescription className="sr-only">
          Main menu, search, account links, and theme
        </DialogDescription>

        <div className="flex flex-col gap-6 px-6 py-6">
          <div className="flex items-center justify-between border-b border-nav-border pb-4">
            {logo}
            <DialogClose
              className={cn(
                "inline-flex size-11 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-high/90 text-on-surface transition-colors hover:bg-surface-container-highest",
                FOCUS_RING,
              )}
              aria-label="Close menu"
            >
              <MarketingCloseIcon className="size-5" />
            </DialogClose>
          </div>

          {topSlot}

          {themeSlot ? (
            <div className="flex items-center gap-3 border-b border-nav-border pb-4">
              {themeSlot}
            </div>
          ) : null}

          <nav aria-label="Mobile primary">
            <ul className="flex flex-col gap-1">
              {sections.map((section, index) => {
                const active = isSectionActive(section);
                const expanded = expandedIndex === index;
                const panelId = `mobile-nav-section-${index}`;
                return (
                  <li key={section.id} className="border-b border-nav-border pb-2 last:border-b-0">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto min-h-11 w-full justify-between gap-2 rounded-none px-0 py-2 text-left font-label text-sm font-medium uppercase tracking-wide hover:bg-transparent"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => setExpandedIndex(expanded ? null : index)}
                    >
                      <span
                        className={
                          active
                            ? "text-brand-900 dark:text-on-surface"
                            : "text-nav-text dark:text-on-surface-variant"
                        }
                      >
                        {section.label}
                      </span>
                      <MarketingChevronDownIcon
                        className={cn(
                          "shrink-0 text-brand-900 transition-transform motion-reduce:transition-none dark:text-on-surface",
                          expanded ? "rotate-180" : "rotate-0",
                        )}
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
                              <li key={`${section.id}-${row.label}-${row.href}`}>
                                <Link
                                  href={row.href}
                                  aria-current={isLinkCurrent?.(row.href) ? "page" : undefined}
                                  className={cn(
                                    "block rounded-sm py-1.5 font-body text-sm text-brand-900 aria-[current=page]:font-semibold dark:text-on-surface",
                                    FOCUS_RING,
                                  )}
                                  onClick={close}
                                >
                                  {row.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="py-1 font-body text-xs text-brand-400 dark:text-on-surface-variant">
                            Nothing to show yet.
                          </p>
                        )}
                        {section.viewAllHref ? (
                          <Link
                            href={section.viewAllHref}
                            className={cn(
                              "rounded-sm py-2 font-label text-xs font-semibold uppercase tracking-wide text-brand-900 dark:text-on-surface",
                              FOCUS_RING,
                            )}
                            onClick={close}
                          >
                            {section.viewAllLabel ?? "View all"}
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </nav>

          {utilityLinks && utilityLinks.length > 0 ? (
            <ul className="flex flex-col gap-1 border-t border-nav-border pt-4">
              {utilityLinks.map((item) => (
                <li key={`drawer-${item.label}`}>
                  <Link
                    href={item.href}
                    aria-current={isLinkCurrent?.(item.href) ? "page" : undefined}
                    className={cn(
                      "block rounded-sm py-2 font-label text-sm font-medium uppercase tracking-wide text-brand-900 aria-[current=page]:underline dark:text-on-surface",
                      FOCUS_RING,
                    )}
                    onClick={close}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {footerSlot}
        </div>
      </DialogContent>
    </Dialog>
  );
}
