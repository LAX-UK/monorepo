import {
  type AccountNavId,
  type AccountNavItemVm,
  activeAccountNavId,
} from "@/server/domain/account-nav.vm";

/** The destinations with a tab of their own; every other menu page is reached through More. */
export const ACCOUNT_TAB_IDS = ["home", "portfolio", "money"] as const satisfies AccountNavId[];

export type AccountBottomTabSpec = {
  key: "home" | "portfolio" | "money" | "more";
  label: string;
  /** Present for the three page tabs; More opens the menu instead. */
  href?: string;
  /** The nav entry (and so the icon) the tab stands for. */
  navId?: AccountNavId;
  /** Paths that make the tab current for this page. */
  paths: string[];
};

/**
 * The phone tab bar's tabs: Home, Portfolio and Money from the menu, then More. A page that is
 * in the menu but has no tab (Security, Help, Selling) marks More as current, since More is
 * where it is reached from. A page outside the menu marks nothing.
 */
export function buildAccountBottomTabs(
  items: readonly AccountNavItemVm[],
  pathname: string,
): AccountBottomTabSpec[] {
  const active = activeAccountNavId(pathname, items);
  const tabs: AccountBottomTabSpec[] = [];
  for (const id of ACCOUNT_TAB_IDS) {
    const item = items.find((entry) => entry.id === id);
    if (!item) continue;
    tabs.push({
      key: id,
      label: item.label,
      href: item.href,
      navId: id,
      paths: active === id ? [item.href] : [],
    });
  }
  const inMore = active !== null && !(ACCOUNT_TAB_IDS as readonly string[]).includes(active);
  tabs.push({ key: "more", label: "More", paths: inMore ? [pathname] : [] });
  return tabs;
}
