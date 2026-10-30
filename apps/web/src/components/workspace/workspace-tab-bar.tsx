"use client";

import { AccountSwitcherSheet } from "@/components/layout/account-switcher/account-switcher-sheet";
import { AccountTile } from "@/components/layout/account-switcher/account-tile";
import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { type ClientNavSection, navItemMatches } from "@/lib/navigation/client-nav-model";
import { cn } from "@auction/ui";
import { Dialog } from "@auction/ui/lax";
import { ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { type WorkspaceNavCounts, WorkspaceNavList } from "./workspace-nav-list";

const MORE_ID = "more";

/**
 * Which tab is current. A tab is current when the page or its parent is that tab; any other
 * page was reached from More, so More is current and the bar never shows no tab selected.
 */
export function currentTabId(tabs: readonly AppShellNavItem[], pathname: string): string {
  const own = tabs.find((tab) => tab.id !== MORE_ID && navItemMatches(tab, pathname));
  return own?.id ?? MORE_ID;
}

/**
 * What More lists: every menu entry that is not already a tab, in the menu's order, with the
 * account entries (Notifications, Bid settings, LAX Account) last.
 */
export function moreSheetSections(
  sections: readonly ClientNavSection[],
  tabs: readonly AppShellNavItem[],
): ClientNavSection[] {
  const inTabs = new Set(tabs.map((tab) => tab.id));
  const rest = sections
    .map((section) => ({ ...section, items: section.items.filter((item) => !inTabs.has(item.id)) }))
    .filter((section) => section.items.length > 0);
  return [
    ...rest.filter((section) => section.id !== "account"),
    ...rest.filter((section) => section.id === "account"),
  ];
}

function TabCount({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span
      aria-hidden
      className="absolute -top-1.5 left-[calc(50%+4px)] inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-lax-ink px-1 text-lax-2xs font-semibold text-lax-on-ink tabular-nums"
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

/**
 * The phone's bottom tabs: the role's own four (or fewer) plus More, 64px with the safe area.
 * The current tab has an ink bar along its top edge. More opens a sheet with the account
 * switcher at the top and the whole menu under it.
 */
export function WorkspaceTabBar({
  tabs,
  sections,
  account,
  pathname,
  counts,
}: {
  tabs: readonly AppShellNavItem[];
  sections: readonly ClientNavSection[];
  account: AccountChrome;
  pathname: string;
  counts: WorkspaceNavCounts;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const current = currentTabId(tabs, pathname);
  const moreSections = moreSheetSections(sections, tabs);
  const moreCount = counts.unread;
  return (
    <>
      <nav
        aria-label="Bid, tabs"
        className="shrink-0 border-t border-lax-line bg-lax-page/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-sm lg:hidden"
      >
        <ul
          className="grid h-16"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === current;
            const count = tab.id === MORE_ID ? moreCount : (counts.needsYou[tab.id] ?? 0);
            const className = cn(
              "lax-focus-inset relative flex h-full w-full flex-col items-center justify-center gap-1 text-lax-12",
              active ? "font-semibold text-lax-fg" : "text-lax-muted",
              active &&
                "before:absolute before:top-0 before:left-1/2 before:h-[3px] before:w-8 before:-translate-x-1/2 before:rounded-b-full before:bg-lax-ink",
            );
            const body = (
              <>
                <span className="relative">
                  <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                  <TabCount value={count} />
                </span>
                <span className="max-w-full truncate px-1">{tab.shortLabel ?? tab.label}</span>
                {count > 0 ? <span className="sr-only">, {count}</span> : null}
              </>
            );
            return (
              <li key={tab.id}>
                {tab.id === MORE_ID ? (
                  <button
                    type="button"
                    className={className}
                    aria-haspopup="dialog"
                    aria-expanded={moreOpen}
                    {...(active ? { "aria-current": "page" as const } : {})}
                    onClick={() => setMoreOpen(true)}
                  >
                    {body}
                  </button>
                ) : (
                  <Link
                    href={tab.href}
                    prefetch
                    className={className}
                    {...(active ? { "aria-current": "page" as const } : {})}
                  >
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <Dialog open={moreOpen} onOpenChange={setMoreOpen} title="More">
        <div className="flex flex-col gap-4">
          {account.switcher ? (
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                setSwitcherOpen(true);
              }}
              aria-label={`Account: ${account.current.name}, ${account.current.detail}. Switch account`}
              className="lax-focus flex min-h-14 w-full items-center gap-3 rounded-lax-card bg-lax-surface px-3 text-left shadow-[inset_0_0_0_1px_var(--lax-line)]"
            >
              <AccountTile account={account.current} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lax-14 font-semibold text-lax-fg">
                  {account.current.name}
                </span>
                <span className="block truncate text-lax-12 text-lax-muted">
                  {account.current.detail}
                </span>
              </span>
              <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-lax-muted" />
            </button>
          ) : null}
          <nav aria-label="Bid, all pages">
            <WorkspaceNavList
              sections={moreSections}
              pathname={pathname}
              counts={counts}
              onNavigate={() => setMoreOpen(false)}
            />
          </nav>
        </div>
      </Dialog>
      {account.switcher ? (
        <AccountSwitcherSheet
          switcher={account.switcher}
          open={switcherOpen}
          onOpenChange={setSwitcherOpen}
        />
      ) : null}
    </>
  );
}
