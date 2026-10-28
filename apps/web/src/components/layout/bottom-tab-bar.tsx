"use client";

import type { AppShellNavItem } from "@/components/layout/app-shell-nav";
import { MobileMoreSheet } from "@/components/layout/mobile-more-sheet";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import type { SessionUser } from "@/lib/data/contracts";
import { formatUnreadTabLabel } from "@/lib/shell/format-unread-tab-label";
import { useShellConfig } from "@/lib/shell/shell-config-context";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

function isActive(pathname: string, href: string): boolean {
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

  if (tabs.length === 0) return null;

  const moreSheetVariant = config.role === "client" ? "client" : "staff";
  const hasMoreTab = tabs.some((item) => item.id === "more");

  return (
    <>
      <nav
        aria-label="Primary mobile dashboard navigation"
        className="fixed inset-x-0 bottom-[var(--bottom-tab-bar-bottom,0px)] z-[var(--z-site-chrome,50)] border-t border-border-hairline bg-surface-container-lowest/95 px-1 pb-[max(0.5rem,var(--safe-area-bottom,env(safe-area-inset-bottom)))] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.08)] backdrop-blur-sm lg:hidden"
        style={{ minHeight: "var(--bottom-nav-height, 64px)" }}
      >
        <ul
          className="grid"
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
                    <span
                      className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 font-label text-[10px] font-bold text-on-error"
                      aria-hidden
                    >
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{item.shortLabel ?? item.label}</span>
              </>
            );
            const tabClassName = cn(
              // Links and the More button share one box: at least 44px each way, icon over a 12px label.
              "flex h-auto min-h-[var(--tap-target-min,44px)] w-full min-w-[var(--tap-target-min,44px)] flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 font-label text-xs font-normal transition-colors [&_svg]:size-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-0 focus-visible:ring-offset-0",
              active
                ? "bg-primary-container/20 text-primary"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            );

            return (
              <li key={item.id} className="min-w-0">
                {more ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className={tabClassName}
                    onClick={() => setMoreOpen(true)}
                    aria-label="Open more dashboard actions"
                  >
                    {content}
                  </Button>
                ) : (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={
                      // The name starts with the visible label, so voice control matches it.
                      item.id === "notifications"
                        ? formatUnreadTabLabel(item.shortLabel ?? item.label, unread)
                        : undefined
                    }
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
          items={moreItems}
          user={user}
          sections={config.navSections}
          account={config.clientAccount}
        />
      ) : null}
    </>
  );
}
