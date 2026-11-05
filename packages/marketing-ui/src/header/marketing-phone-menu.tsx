"use client";

import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@auction/ui/components/dialog";
import Link from "next/link";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import type { LaxFamilyBarLink } from "../lax-family-bar.js";
import { LaxFamilyMenuLinks } from "../lax-family-menu-links.js";
import { MarketingChevronDownIcon, MarketingCloseIcon } from "../marketing-icons.js";
import type { MarketingMegaNavSection } from "./marketing-header-mega-nav.js";

export type MarketingPhoneMenuHelpLink = { label: string; href: string };

export type MarketingPhoneMenuProps<TSection extends MarketingMegaNavSection> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Closes any expanded section when this changes (pass the pathname). */
  resetKey: string;
  /** The product's lockup, first in the header row. */
  lockup: ReactNode;
  /** The LAX top bar's links, in the bar's order. */
  familyLinks: readonly LaxFamilyBarLink[];
  sections: readonly TSection[];
  isSectionActive: (section: TSection) => boolean;
  isLinkCurrent?: (href: string) => boolean;
  helpLinks: readonly MarketingPhoneMenuHelpLink[];
  /** The Theme toggle; always the last item. */
  themeSlot: ReactNode;
  /** The menu button; focus returns here on close. Defaults to whatever had focus on open. */
  returnFocusRef?: RefObject<HTMLElement | null>;
};

const CONTENT_CLASS =
  "fixed inset-y-0 top-0 right-0 left-auto z-[var(--z-overlay,60)] !flex h-full max-h-[100dvh] w-[min(100vw-3rem,24rem)] max-w-sm translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-l border-nav-border bg-surface p-0 shadow-xl sm:max-w-sm sm:rounded-none";

/**
 * The phone menu: a drawer from the right. Order is fixed: lockup and Close, the LAX top bar row,
 * the main navigation, help links, and the Theme toggle last. There is no search and no account
 * block (both have their own place in the top bar and the bottom bar). Focus is trapped inside
 * while it is open and returns to the menu button on close; the bottom bar hides and goes inert
 * because this is an open modal.
 */
export function MarketingPhoneMenu<TSection extends MarketingMegaNavSection>({
  open,
  onOpenChange,
  resetKey,
  lockup,
  familyLinks,
  sections,
  isSectionActive,
  isLinkCurrent,
  helpLinks,
  themeSlot,
  returnFocusRef,
}: MarketingPhoneMenuProps<TSection>) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const close = () => onOpenChange(false);

  // The menu opens from state, not from a Radix trigger, so remember what had focus on open.
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== "undefined") {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasOpen.current = open;
  const returnFocus = (event: Event) => {
    const target = returnFocusRef?.current ?? opener.current;
    if (!target?.isConnected || target === document.body) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: collapse sections on navigation and on close
  useEffect(() => {
    setExpanded(null);
  }, [resetKey, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[var(--z-overlay,60)]"
        closeClassName="hidden"
        onCloseAutoFocus={returnFocus}
        className={cn("border-border-hairline p-0 sm:p-0", CONTENT_CLASS)}
      >
        <DialogTitle className="sr-only">Menu</DialogTitle>
        <DialogDescription className="sr-only">
          Site navigation, help links and theme
        </DialogDescription>

        <div className="flex flex-col gap-6 px-6 py-6">
          <div
            data-testid="phone-menu-header"
            className="flex items-center justify-between border-b border-nav-border pb-4"
          >
            {lockup}
            <DialogClose
              aria-label="Close menu"
              className={cn(
                "inline-flex size-11 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-high/90 text-on-surface transition-colors hover:bg-surface-container-highest",
                FOCUS_RING,
              )}
            >
              <MarketingCloseIcon className="size-5" />
            </DialogClose>
          </div>

          <LaxFamilyMenuLinks links={familyLinks} onNavigate={close} />

          {sections.length > 0 ? (
            <nav aria-label="Main">
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {sections.map((section) => {
                  const isOpen = expanded === section.id;
                  const panelId = `phone-menu-${section.id}`;
                  const active = isSectionActive(section);
                  const rowClass = cn(
                    "flex min-h-11 w-full items-center justify-between gap-2 rounded-sm py-2 text-left font-label text-sm font-medium",
                    active ? "text-on-surface" : "text-on-surface-variant",
                    FOCUS_RING,
                  );
                  return (
                    <li
                      key={section.id}
                      className="border-b border-nav-border pb-2 last:border-b-0"
                    >
                      {section.linkHref ? (
                        <Link
                          href={section.linkHref}
                          aria-current={active ? "page" : undefined}
                          className={rowClass}
                          onClick={close}
                        >
                          {section.label}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className={rowClass}
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          onClick={() => setExpanded(isOpen ? null : section.id)}
                        >
                          <span>{section.label}</span>
                          <MarketingChevronDownIcon
                            className={cn(
                              "shrink-0 transition-transform motion-reduce:transition-none",
                              isOpen && "rotate-180",
                            )}
                          />
                        </button>
                      )}
                      {isOpen ? (
                        <div
                          id={panelId}
                          className="mt-1 flex flex-col gap-1 border-l border-nav-border pl-3"
                        >
                          <ul className="m-0 flex list-none flex-col gap-1 p-0">
                            {section.items.map((row) => (
                              <li key={`${section.id}-${row.href}`}>
                                <Link
                                  href={row.href}
                                  aria-current={isLinkCurrent?.(row.href) ? "page" : undefined}
                                  className={cn(
                                    "block rounded-sm py-1.5 font-body text-sm text-on-surface aria-[current=page]:font-semibold",
                                    FOCUS_RING,
                                  )}
                                  onClick={close}
                                >
                                  {row.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                          {section.viewAllHref ? (
                            <Link
                              href={section.viewAllHref}
                              className={cn(
                                "rounded-sm py-2 font-label text-sm font-semibold text-on-surface",
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
          ) : null}

          {helpLinks.length > 0 ? (
            <nav aria-label="Help" className="border-t border-nav-border pt-4">
              <ul className="m-0 flex list-none flex-col p-0">
                {helpLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={close}
                      className={cn(
                        "flex min-h-11 items-center rounded-sm font-label text-sm font-medium text-on-surface hover:underline",
                        FOCUS_RING,
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <div
            data-testid="phone-menu-theme"
            className="flex items-center gap-3 border-t border-nav-border pt-4"
          >
            {themeSlot}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
