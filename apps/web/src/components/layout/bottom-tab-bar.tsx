"use client";

import type { AppShellNavItem } from "@/components/layout/app-shell-nav";
import { MobileMoreSheet } from "@/components/layout/mobile-more-sheet";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import type { SessionUser } from "@/lib/data/contracts";
import { useShellConfig } from "@/lib/shell/shell-config-context";
import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Mobile bottom tab bar driven by ShellConfig.mobileNav (lg:hidden). */
export function BottomTabBar({ user }: { user: Pick<SessionUser, "name" | "email" | "image"> }) {
  const config = useShellConfig();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs = config.mobileNav;
  const moreItems = useMemo(
    () => (config.moreSheetNav ?? []) as AppShellNavItem[],
    [config.moreSheetNav],
  );
  const { unread } = useUnreadNotifications();
  const workspace = config.clientWorkspaceMode ?? "buying";

  if (tabs.length === 0) return null;

  const moreSheetVariant = config.role === "client" ? "client" : "staff";
  const hasMoreTab = tabs.some((item) => item.id === "more");

  return (
    <>
      <nav
        aria-label="Primary mobile dashboard navigation"
        className="fixed inset-x-0 bottom-[var(--bottom-tab-bar-bottom,0px)] z-[var(--z-site-chrome,50)] border-t border-border-hairline bg-surface-container-lowest/95 px-2 pb-[max(0.5rem,var(--safe-area-bottom,env(safe-area-inset-bottom)))] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.08)] backdrop-blur-sm lg:hidden"
        style={{ minHeight: "var(--bottom-nav-height, 64px)" }}
      >
        <ul
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((item) => {
            const Icon = item.icon;
            const more = item.id === "more";
            const active =
              !more && (item.match ? item.match(pathname) : isActive(pathname, item.href));
            const content = (
              <>
                <span className="relative">
                  <Icon className="size-5" aria-hidden />
                  {item.id === "notifications" && unread > 0 ? (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 font-label text-[10px] font-bold text-on-error">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 max-w-full truncate text-[10px]">{item.label}</span>
              </>
            );
            const tabClassName = cn(
              "flex min-h-[var(--tap-target-min,44px)] w-full flex-col items-center justify-center rounded-lg px-1 font-label transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              active
                ? "bg-primary-container/20 text-primary"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            );

            return (
              <li key={item.id} className="min-w-0">
                {more ? (
                  <button
                    type="button"
                    className={tabClassName}
                    onClick={() => setMoreOpen(true)}
                    aria-label="Open more dashboard actions"
                  >
                    {content}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={tabClassName}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      {hasMoreTab ? (
        <MobileMoreSheet
          open={moreOpen}
          onOpenChange={setMoreOpen}
          variant={moreSheetVariant}
          clientWorkspaceMode={workspace}
          items={moreItems}
          user={user}
        />
      ) : null}
    </>
  );
}
