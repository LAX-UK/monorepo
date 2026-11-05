import type { ReactNode } from "react";

/** A badge on a tab: a plain dot, or a count (shown as "9+" above nine). */
export type MarketingBottomTabBadge = { kind: "dot" } | { kind: "count"; count: number };

type TabBase = {
  key: string;
  label: string;
  icon: ReactNode;
  /** Paths that make this tab the current one. "/" matches only the home page. */
  paths: readonly string[];
  badge?: MarketingBottomTabBadge | null;
};

/** A tab that goes to a page. */
export type MarketingBottomTabLink = TabBase & { href: string; action?: undefined };

/** A tab that runs an action; `search` opens the product's existing search dialog. */
export type MarketingBottomTabAction = TabBase & { action: "search"; href?: undefined };

export type MarketingBottomTab = MarketingBottomTabLink | MarketingBottomTabAction;

export const BOTTOM_TAB_COUNT_CAP = 9;

function cleanPath(path: string): string {
  const bare = path.split(/[?#]/)[0] ?? "";
  return bare.length > 1 ? bare.replace(/\/+$/, "") : bare || "/";
}

/** Whether `pathname` is one of the tab's paths, or inside one (never for "/" except home). */
export function isTabCurrent(tab: Pick<MarketingBottomTab, "paths">, pathname: string): boolean {
  const current = cleanPath(pathname);
  return tab.paths.some((raw) => {
    const path = cleanPath(raw);
    if (path === "/") return current === "/";
    return current === path || current.startsWith(`${path}/`);
  });
}

/** The text of a count badge: the number, or "9+" above nine. Null when there is nothing to show. */
export function badgeCountText(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > BOTTOM_TAB_COUNT_CAP ? `${BOTTOM_TAB_COUNT_CAP}+` : String(Math.floor(count));
}
