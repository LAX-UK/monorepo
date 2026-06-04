"use client";

import { ChromeIconButton } from "@/components/marketing/chrome-icon-button";
import { ChromePopoverPanel } from "@/components/marketing/chrome-popover-panel";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useAuthHeaderLinks } from "@/lib/auth/use-auth-header-links";
import {
  SITE_HEADER_CHROME,
  type SiteHeaderTone,
  headerChromeIconClass,
} from "@/lib/layout/header-chrome-tone";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const MENU_ID = "header-guest-account-menu";

function menuItemsFromPanel(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return [];
  return [...panel.querySelectorAll<HTMLElement>("[data-guest-menu-item]")];
}

type Props = {
  headerTone?: SiteHeaderTone;
};

/** Signed-out account entry — icon trigger with Sign in / Create account menu. */
export function HeaderGuestMenu({ headerTone = "on-light" }: Props) {
  const { signInHref, registerHref } = useAuthHeaderLinks();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusFirstAfterOpenRef = useRef(false);
  const pathname = usePathname();

  const closeMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    void pathname;
    setOpen(false);
  }, [pathname]);

  useEscapeKey(open, closeMenu);
  useClickOutside(open, wrapRef, closeMenu);

  const focusFirstItem = useCallback(() => {
    const items = menuItemsFromPanel(panelRef.current);
    queueMicrotask(() => items[0]?.focus());
  }, []);

  useLayoutEffect(() => {
    if (!open || !focusFirstAfterOpenRef.current) return;
    focusFirstAfterOpenRef.current = false;
    focusFirstItem();
  }, [open, focusFirstItem]);

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        focusFirstAfterOpenRef.current = true;
        setOpen(true);
      } else {
        focusFirstItem();
      }
    }
    if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      const items = menuItemsFromPanel(panelRef.current);
      items[items.length - 1]?.focus();
    }
  };

  const onPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = menuItemsFromPanel(panelRef.current);
    if (items.length === 0) return;
    const active = document.activeElement;
    const i = items.indexOf(active as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === "ArrowDown" ? Math.min(i + 1, items.length - 1) : Math.max(i - 1, 0);
    items[next]?.focus();
  };

  return (
    <div className="relative flex shrink-0 items-center gap-1" ref={wrapRef}>
      <ChromeIconButton
        ref={triggerRef}
        label="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={MENU_ID}
        className={headerChromeIconClass(headerTone)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <User aria-hidden />
      </ChromeIconButton>
      <span
        className={cn(
          SITE_HEADER_CHROME,
          "hidden font-label text-xs font-medium uppercase tracking-[0.18em] xl:inline",
          headerTone === "on-dark" ? "text-hero-foreground/85" : "text-on-surface-variant",
        )}
      >
        Account
      </span>

      {open ? (
        <ChromePopoverPanel
          ref={panelRef}
          id={MENU_ID}
          role="menu"
          aria-label="Account"
          className="w-[min(100vw-2rem,16rem)]"
          onKeyDown={onPanelKeyDown}
        >
          <div className="border-b border-nav-border px-3 py-2.5 dark:border-border-hairline">
            <p className="font-body text-sm font-medium text-brand-900 dark:text-on-surface">
              Your account
            </p>
            <p className="mt-1 font-body text-xs leading-relaxed text-brand-400 dark:text-on-surface-variant">
              Register to bid, save works, and manage your account.
            </p>
          </div>
          <div className="flex flex-col gap-1 px-2 py-2">
            <Link
              href={signInHref}
              role="menuitem"
              data-guest-menu-item=""
              className={cn(
                "block min-h-11 rounded-md px-2 py-2.5 font-label text-sm font-medium uppercase tracking-wide text-brand-900 transition-colors hover:bg-page-bg focus-visible:bg-page-bg dark:text-on-surface dark:hover:bg-surface-container-low",
                FOCUS_RING,
              )}
              onClick={closeMenu}
            >
              Sign in
            </Link>
            <Link
              href={registerHref}
              role="menuitem"
              data-guest-menu-item=""
              className={cn(
                "inline-flex min-h-11 w-full items-center justify-center rounded bg-cta-bg px-3 py-2 text-center font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on transition-opacity hover:opacity-95",
                FOCUS_RING,
              )}
              onClick={closeMenu}
            >
              Create account
            </Link>
          </div>
        </ChromePopoverPanel>
      ) : null}
    </div>
  );
}
