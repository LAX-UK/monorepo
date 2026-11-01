"use client";

import { ChromePopoverPanel } from "@/components/marketing/chrome-popover-panel";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useIsLg } from "@/hooks/use-is-lg";
import type { SessionUser } from "@/lib/data/contracts";
import type { SiteHeaderTone } from "@/lib/layout/header-chrome-tone";
import type { AccountMenuEntry } from "@/lib/navigation/account-menu-model";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/lax";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccountMenuItems } from "./account-menu-items";
import { AccountMenuIdentity } from "./account-menu/account-menu-identity";
import { AccountMenuSheet } from "./account-menu/account-menu-sheet";
import { ClientAccountMenu } from "./account-menu/client-account-menu";
import { personInitials } from "./account-menu/person-initials";
import {
  type HeaderAccountMenuState,
  useHeaderAccountMenu,
} from "./account-menu/use-header-account-menu";
import { LogoutButton } from "./logout-button";

const MENU_ID = "header-account-menu";

function menuItemsFromPanel(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return [];
  return [...panel.querySelectorAll<HTMLElement>("[data-account-menu-item]")];
}

type HeaderUserMenuProps = {
  user: SessionUser;
  headerTone?: SiteHeaderTone;
  laxProductLinks?: LaxProductLinkVm[];
};

/** A staff account's menu: other LAX products, the admin area, LAX Account, Sign out. */
function StaffMenuBody({
  groups,
  otherProducts,
  onNavigate,
}: {
  groups: AccountMenuEntry[][];
  otherProducts: LaxProductLinkVm[];
  onNavigate: () => void;
}) {
  return (
    <div className="py-1">
      {otherProducts.length > 0 ? (
        <div className="border-b border-nav-border px-3 py-2 dark:border-border-hairline">
          <p className="font-label text-xs font-medium text-brand-400 dark:text-on-surface-variant">
            LAX products
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {otherProducts.map((item) => (
              <a
                key={item.id}
                href={item.href}
                role="menuitem"
                data-account-menu-item=""
                className="block px-0 py-1.5 font-label text-sm font-medium text-brand-900 transition-colors hover:text-link focus-visible:text-link focus-visible:underline focus-visible:outline-none dark:text-on-surface"
                rel="noopener noreferrer"
                onClick={onNavigate}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
      <AccountMenuItems groups={groups} variant="header" menu onNavigate={onNavigate} />
      <hr className="my-1 border-0 border-t border-nav-border dark:border-border-hairline" />
      <LogoutButton
        onBeforeNavigate={onNavigate}
        role="menuitem"
        data-account-menu-item=""
        className="block w-full px-3 py-2.5 text-left font-label text-sm font-medium text-brand-900 transition-colors hover:bg-page-bg focus-visible:bg-page-bg focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-on-surface dark:hover:bg-surface-container-low"
      />
    </div>
  );
}

/** The menu proper for whoever is signed in, on the desktop dropdown. */
function PopoverMenuBody({
  state,
  otherProducts,
  onNavigate,
}: {
  state: HeaderAccountMenuState;
  otherProducts: LaxProductLinkVm[];
  onNavigate: () => void;
}) {
  if (state.kind === "staff") {
    return (
      <StaffMenuBody groups={state.groups} otherProducts={otherProducts} onNavigate={onNavigate} />
    );
  }
  return <ClientAccountMenu menu={state.menu} surface="popover" onNavigate={onNavigate} />;
}

/**
 * The signed-in avatar in the public header. On wide screens it opens the account menu as a
 * dropdown; on phones it opens a short account-only sheet (the site menu stays on the menu
 * button). A dot on the avatar says something is waiting.
 */
export function HeaderUserMenu({
  user,
  headerTone = "on-light",
  laxProductLinks = [],
}: HeaderUserMenuProps) {
  const otherProducts = laxProductLinks.filter((link) => !link.current);
  const [open, setOpen] = useState(false);
  const isLg = useIsLg();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusFirstAfterOpenRef = useRef(false);
  const pathname = usePathname();
  const state = useHeaderAccountMenu(user);
  const somethingDue = state.kind === "client" && state.chip !== null;

  const closeMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    void pathname;
    setOpen(false);
  }, [pathname]);

  const popoverOpen = open && isLg;
  useEscapeKey(popoverOpen, closeMenu);
  useClickOutside(popoverOpen, wrapRef, closeMenu);

  const focusFirstItem = useCallback(() => {
    const items = menuItemsFromPanel(panelRef.current);
    queueMicrotask(() => items[0]?.focus());
  }, []);

  useLayoutEffect(() => {
    if (!popoverOpen || !focusFirstAfterOpenRef.current) return;
    focusFirstAfterOpenRef.current = false;
    focusFirstItem();
  }, [popoverOpen, focusFirstItem]);

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!isLg) return;
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

  const displayName = user.name.trim() || user.email;
  const firstName = displayName.split(/\s+/)[0] ?? displayName;
  const onDark = headerTone === "on-dark";

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        className={cn(
          "h-auto max-w-[200px] justify-start gap-2 bg-transparent p-1 text-left transition-[color,background-color] duration-300 ease-out motion-reduce:transition-none lg:pr-2",
          onDark
            ? "text-hero-foreground hover:bg-white/10"
            : "hover:bg-page-bg dark:hover:bg-surface-container-low",
          popoverOpen && !onDark && "bg-page-bg dark:bg-surface-container-low",
        )}
        aria-haspopup={isLg ? "menu" : "dialog"}
        aria-expanded={open}
        aria-controls={isLg ? MENU_ID : undefined}
        aria-label={somethingDue ? "Account menu, something needs you" : "Account menu"}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="relative shrink-0">
          <PersonAvatar
            src={user.image}
            name={displayName}
            initials={personInitials(user.name, user.email)}
            className="size-9"
          />
          {somethingDue ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-danger"
            />
          ) : null}
        </span>
        <span
          className={cn(
            "hidden min-w-0 truncate font-label text-sm font-medium leading-tight lg:inline",
            onDark ? "text-hero-foreground" : "text-brand-900 dark:text-on-surface",
          )}
        >
          {firstName}
        </span>
        <ChevronDown
          className={cn(
            "hidden shrink-0 text-base! transition-transform duration-200 motion-reduce:transition-none lg:block",
            onDark ? "text-hero-foreground" : "text-brand-900 dark:text-on-surface",
            popoverOpen ? "rotate-180" : "",
          )}
          aria-hidden
        />
      </Button>

      {popoverOpen ? (
        // Who is signed in sits above the menu: only menu items live inside role="menu".
        <ChromePopoverPanel
          ref={panelRef}
          className="w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border-outline-variant/60 py-0 shadow-[var(--shadow-pop,0_12px_32px_-8px_rgb(0_0_0/0.18))] dark:border-outline-variant/60"
          onKeyDown={onPanelKeyDown}
        >
          <div className="border-b border-outline-variant/60 p-4">
            <AccountMenuIdentity user={user} />
          </div>
          <div id={MENU_ID} role="menu" aria-label="Account">
            <PopoverMenuBody state={state} otherProducts={otherProducts} onNavigate={closeMenu} />
          </div>
        </ChromePopoverPanel>
      ) : null}

      {!isLg ? (
        <AccountMenuSheet user={user} open={open} onOpenChange={setOpen}>
          {state.kind === "client" ? (
            <ClientAccountMenu
              menu={state.menu}
              surface="sheet"
              onNavigate={() => setOpen(false)}
            />
          ) : (
            <div className="flex flex-col py-2">
              <AccountMenuItems
                groups={state.groups}
                variant="drawer"
                menu={false}
                onNavigate={() => setOpen(false)}
              />
              <LogoutButton
                onBeforeNavigate={() => setOpen(false)}
                className="mt-2 block w-full rounded-md border border-nav-border py-3 text-center font-label text-sm font-medium text-brand-900 transition-colors hover:bg-page-bg disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-hairline dark:text-on-surface dark:hover:bg-surface-container-low"
              />
            </div>
          )}
        </AccountMenuSheet>
      ) : null}
    </div>
  );
}
