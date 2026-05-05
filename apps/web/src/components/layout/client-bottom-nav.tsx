"use client";

import { getClientMobileBottomTabs, getClientNavItems } from "@/components/layout/app-shell-nav";
import { ClientMobileMoreSheet } from "@/components/layout/client-mobile-more-sheet";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type Props = {
  clientWorkspaceMode: ClientWorkspaceMode;
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ClientBottomNav({ clientWorkspaceMode }: Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs = useMemo(() => getClientMobileBottomTabs(clientWorkspaceMode), [clientWorkspaceMode]);
  const allItems = useMemo(() => getClientNavItems(clientWorkspaceMode), [clientWorkspaceMode]);
  const tabIds = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs]);
  const moreItems = allItems.filter((item) => !tabIds.has(item.id));
  const { unread } = useUnreadNotifications();

  return (
    <>
      <nav
        aria-label="Primary mobile dashboard navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/20 bg-surface-container-lowest/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.08)] backdrop-blur-sm lg:hidden"
      >
        <ul className="grid grid-cols-5 gap-1">
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
            return (
              <li key={item.id} className="min-w-0">
                {more ? (
                  <button
                    type="button"
                    className="flex min-h-12 w-full flex-col items-center justify-center rounded-lg px-1 font-label text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    onClick={() => setMoreOpen(true)}
                    aria-label="Open more dashboard actions"
                  >
                    {content}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 flex-col items-center justify-center rounded-lg px-1 font-label transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      active
                        ? "bg-primary-container/20 text-primary"
                        : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                    )}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <ClientMobileMoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        clientWorkspaceMode={clientWorkspaceMode}
        items={moreItems}
      />
    </>
  );
}
