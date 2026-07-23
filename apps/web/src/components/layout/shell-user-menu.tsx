"use client";

import { type AppShellRole, appShellRoleMeta } from "@/components/layout/app-shell-nav";
import { accountNavLinks } from "@/components/layout/header-account-nav";
import { LogoutButton } from "@/components/layout/logout-button";
import { DensityTweakSection, ThemeTweakSection } from "@/components/layout/tweaks-popover";
import { MediaImage } from "@/components/ui/media-image";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { shellRolePillLabel } from "@/lib/admin/staff-role-presenter";
import type { SessionUser } from "@/lib/data/contracts";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronDown, Globe2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const MENU_ID = "shell-account-menu";

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
  return [...panel.querySelectorAll<HTMLElement>("[data-shell-menu-item]")];
}

type ShellUserMenuProps = {
  user: SessionUser;
  role: AppShellRole;
};

export function ShellUserMenu({ user, role }: ShellUserMenuProps) {
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

  const displayName = user.name.trim() || user.email;
  const roleMeta = appShellRoleMeta[role];
  const rolePillLabel = shellRolePillLabel(user);
  const isClient = role === "client";
  const navLinks = isClient ? accountNavLinks(user) : [];

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        className="h-auto max-w-[220px] justify-start gap-2 rounded-full bg-transparent py-1 pl-1 pr-2 text-left hover:bg-surface-container-low"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={MENU_ID}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <div className="relative shrink-0">
          <MediaImage
            src={user.image ?? null}
            alt={displayName}
            label={initials(user.name, user.email)}
            shape="circle"
            sizes="40px"
            className="size-10"
          />
          <span
            className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-surface-container-lowest bg-positive"
            aria-hidden
          />
        </div>
        <span className="hidden min-w-0 max-w-[8rem] truncate font-label text-sm font-medium text-on-surface sm:inline">
          {displayName}
        </span>
        <ChevronDown
          className={cn(
            "hidden size-4 shrink-0 text-on-surface-variant transition-transform duration-200 motion-reduce:transition-none sm:block",
            open ? "rotate-180" : "",
          )}
          aria-hidden
        />
      </Button>

      {open ? (
        <div
          ref={panelRef}
          id={MENU_ID}
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(100vw-2rem,18rem)] overflow-hidden rounded-lg border border-shell-stroke bg-surface-container-lowest shadow-[var(--shadow-rest)]"
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
              <span className="font-label text-[10px] font-bold uppercase tracking-[0.12em]">
                {rolePillLabel}
              </span>
            </div>
          </div>

          <div className="border-b border-shell-stroke px-4 py-4">
            <p className="mb-3 font-label text-xs font-semibold uppercase tracking-[0.18em] text-on-surface">
              Display settings
            </p>
            {/* Staff shell also exposes theme via header ThemeToggle; menu is secondary. */}
            <div className="flex flex-col gap-5">
              <DensityTweakSection />
              <ThemeTweakSection />
            </div>
          </div>

          {isClient ? (
            <div className="border-b border-shell-stroke py-1">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  data-shell-menu-item=""
                  className="block px-4 py-2.5 font-label text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-none"
                  onClick={closeMenu}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/"
                role="menuitem"
                data-shell-menu-item=""
                className="flex items-center gap-2 px-4 py-2.5 font-label text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-none"
                onClick={closeMenu}
              >
                <Globe2 className="size-4 shrink-0" aria-hidden />
                Browse LAX.bid
              </Link>
            </div>
          ) : null}

          <div className="py-1">
            <LogoutButton
              onBeforeNavigate={closeMenu}
              role="menuitem"
              data-shell-menu-item=""
              className="block w-full px-4 py-2.5 text-left font-label text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
