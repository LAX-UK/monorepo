"use client";

import { AccountMenuItems, useAccountMenuGroups } from "@/components/layout/account-menu-items";
import { asMenuItem } from "@/components/layout/account-menu/as-menu-item";
import { personInitials } from "@/components/layout/account-menu/person-initials";
import { DesktopAccountFace } from "@/components/layout/account-switcher/desktop-account-face";
import { MenuAccountList } from "@/components/layout/account-switcher/menu-account-list";
import { appShellRoleMeta } from "@/components/layout/app-shell-role-meta";
import { LogoutButton } from "@/components/layout/logout-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DensityTweakSection, ThemeTweakSection } from "@/components/layout/tweaks-popover";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useEscapeKey } from "@/hooks/use-escape-key";
import type { SessionUser } from "@/lib/data/contracts";
import { accountButtonView } from "@/lib/navigation/account-button.vm";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import type { AppShellRole } from "@/lib/shell/session-user-shell-role";
import { shellRolePillLabel } from "@/lib/shell/shell-role-pill-label";
import { Button } from "@auction/ui/components/button";
import { cn } from "@auction/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const MENU_ID = "shell-account-menu";

/**
 * Rows that cannot take focus are skipped. The row being switched to is only aria-disabled and
 * keeps focus during the switch, so it stays in the arrow order.
 */
function isDisabledItem(item: HTMLElement): boolean {
  return item.matches(":disabled");
}

function menuItemsFromPanel(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return [];
  // A row that is disabled (an account mid-switch) cannot take focus, so the arrows skip it.
  return [...panel.querySelectorAll<HTMLElement>("[data-account-menu-item]")].filter(
    (item) => !isDisabledItem(item),
  );
}

type ShellUserMenuProps = {
  user: SessionUser;
  role: AppShellRole;
  /**
   * The account in use and the accounts to switch between. When there is a switcher, the button
   * shows the account in use and the menu opens with the accounts, so the top-right button is
   * the switcher; the sidebar's tile opens the same list.
   */
  account?: AccountChrome | null;
};

export function ShellUserMenu({ user, role, account = null }: ShellUserMenuProps) {
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

  // Opening from the keyboard lands on the account in use when the menu lists accounts, else on
  // the first item.
  const focusFirstItem = useCallback(() => {
    const items = menuItemsFromPanel(panelRef.current);
    const start = items.find((item) => item.getAttribute("aria-current") === "true") ?? items[0];
    queueMicrotask(() => start?.focus());
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

  const displayName = user.name.trim() || user.email;
  // The bar names the person by first name only, so it is never clipped mid-surname; the menu
  // itself shows the full name.
  const firstName = user.name.trim().split(/\s+/)[0] || user.email;
  const roleMeta = appShellRoleMeta[role];
  const rolePillLabel = shellRolePillLabel(user);
  const isClient = role === "client";
  const groups = useAccountMenuGroups(user, isClient);
  const switcher = account?.switcher ?? null;
  const accountView =
    account && switcher
      ? accountButtonView(account.current, {
          initials: personInitials(user.name, user.email),
          name: displayName,
        })
      : null;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        className={cn(
          "h-auto justify-start gap-2 bg-transparent text-left hover:bg-surface-container-low",
          accountView
            ? "min-h-11 max-w-[280px] rounded-lg py-1 pl-1 pr-2 font-normal text-on-surface"
            : "max-w-[220px] rounded-full py-1 pl-1 pr-2",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={MENU_ID}
        aria-label={accountView ? accountView.label : "Account menu"}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        {accountView ? (
          <DesktopAccountFace view={accountView} user={user} open={open} />
        ) : (
          <>
            <PersonAvatar
              src={user.image}
              name={displayName}
              initials={personInitials(user.name, user.email)}
            />
            <span className="hidden max-w-[10rem] truncate font-label text-sm font-medium text-on-surface lg:inline">
              {firstName}
            </span>
            <ChevronDown
              className={cn(
                "hidden size-4 shrink-0 text-on-surface-variant transition-transform duration-200 motion-reduce:transition-none lg:block",
                open ? "rotate-180" : "",
              )}
              aria-hidden
            />
          </>
        )}
      </Button>

      {open ? (
        // The panel holds who is signed in and display settings, then the menu proper: the
        // accounts, pages and Sign out, each a menu item inside role="menu".
        <div
          ref={panelRef}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 max-h-[calc(100dvh-5rem)] w-[min(100vw-2rem,18rem)] overflow-y-auto overscroll-contain rounded-lg border border-shell-stroke bg-surface-container-lowest shadow-[var(--shadow-rest)]"
          onKeyDown={onPanelKeyDown}
        >
          <div className="border-b border-shell-stroke px-4 py-3">
            <p className="truncate font-body text-sm font-medium text-on-surface">{displayName}</p>
            <p className="mt-0.5 truncate font-body text-xs text-on-surface-variant">
              {user.email}
            </p>
            <div
              className={cn(
                "mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
                roleMeta.pillClassName,
              )}
            >
              <span className={cn("size-1.5 rounded-full", roleMeta.dotClassName)} aria-hidden />
              <span className="font-label text-xs font-semibold">{rolePillLabel}</span>
            </div>
          </div>

          {!isClient ? (
            <div className="border-b border-shell-stroke px-4 py-4">
              <p className="mb-3 font-label text-xs font-semibold uppercase tracking-[0.18em] text-on-surface">
                Display settings
              </p>
              <div className="flex flex-col gap-5">
                <DensityTweakSection />
                <ThemeTweakSection />
              </div>
            </div>
          ) : null}

          {isClient ? (
            // The client header has no theme toggle, so keep dark mode one click away.
            <div className="flex items-center justify-between border-b border-shell-stroke px-4 py-1.5">
              <span className="font-label text-sm font-medium text-on-surface">Dark mode</span>
              <ThemeToggle surface="shell" />
            </div>
          ) : null}

          <div id={MENU_ID} role="menu" aria-label="Account">
            {switcher ? (
              // The accounts are the menu's first group, labelled "Switch account" by the list.
              <div className="border-b border-shell-stroke p-1.5">
                <MenuAccountList switcher={switcher} onNavigate={closeMenu} wrapItem={asMenuItem} />
              </div>
            ) : null}
            {isClient ? (
              <div className="border-b border-shell-stroke py-1">
                <AccountMenuItems groups={groups} variant="shell" menu onNavigate={closeMenu} />
              </div>
            ) : null}
            <div className="py-1">
              <LogoutButton
                onBeforeNavigate={closeMenu}
                role="menuitem"
                data-account-menu-item=""
                className="block w-full px-4 py-2.5 text-left font-label text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
