"use client";

import { MediaImage } from "@/components/ui/media-image";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useEscapeKey } from "@/hooks/use-escape-key";
import type { SessionUser } from "@/lib/data/contracts";
import { Button } from "@auction/ui/components/button";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { accountNavLinks } from "./header-account-nav";
import { LogoutButton } from "./logout-button";

const MENU_ID = "header-account-menu";

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  const fromEmail = email[0] ?? "";
  return (first + second).toUpperCase() || fromEmail.toUpperCase() || "?";
}

function menuItemsFromPanel(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return [];
  return [...panel.querySelectorAll<HTMLElement>("[data-account-menu-item]")];
}

type HeaderUserMenuProps = {
  user: SessionUser;
};

export function HeaderUserMenu({ user }: HeaderUserMenuProps) {
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

  const links = accountNavLinks(user);
  const displayName = user.name.trim() || user.email;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        className="h-auto max-w-[200px] justify-start gap-2 py-1 pl-1 pr-2 text-left hover:bg-page-bg motion-reduce:transition-none dark:hover:bg-surface-container-low"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={MENU_ID}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <MediaImage
          src={user.image ?? null}
          alt={displayName}
          label={initials(user.name, user.email)}
          shape="circle"
          sizes="36px"
          className="h-9 w-9 shrink-0"
        />
        <span className="hidden min-w-0 truncate font-label text-sm font-medium uppercase leading-tight text-brand-900 sm:inline dark:text-on-surface">
          {displayName}
        </span>
        <ChevronDown
          className={`shrink-0 text-base! text-brand-900 transition-transform motion-reduce:transition-none dark:text-on-surface ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </Button>

      {open ? (
        <div
          ref={panelRef}
          id={MENU_ID}
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,16rem)] rounded-lg border border-nav-border bg-surface py-2 shadow-sm motion-reduce:shadow-none motion-reduce:transition-none dark:border-outline-variant/20"
          onKeyDown={onPanelKeyDown}
        >
          <div className="border-b border-nav-border px-3 py-2 dark:border-outline-variant/15">
            <p className="truncate font-body text-sm font-medium text-brand-900 dark:text-on-surface">
              {displayName}
            </p>
            <p className="mt-0.5 truncate font-body text-xs text-brand-400 dark:text-on-surface-variant">
              {user.email}
            </p>
          </div>
          <div className="py-1">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                data-account-menu-item=""
                className="block px-3 py-2.5 font-label text-sm font-medium uppercase tracking-wide text-brand-900 transition-colors hover:bg-page-bg focus-visible:bg-page-bg focus-visible:outline-none dark:text-on-surface dark:hover:bg-surface-container-low"
                onClick={closeMenu}
              >
                {item.label}
              </Link>
            ))}
            <LogoutButton
              onBeforeNavigate={closeMenu}
              role="menuitem"
              data-account-menu-item=""
              className="block w-full px-3 py-2.5 text-left font-label text-sm font-medium uppercase tracking-wide text-brand-900 transition-colors hover:bg-page-bg focus-visible:bg-page-bg focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-on-surface dark:hover:bg-surface-container-low"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
