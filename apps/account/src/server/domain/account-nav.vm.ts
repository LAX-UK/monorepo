import { type LaxFamilyLinkVm, buildLaxFamilyLinks } from "@auction/lax-ecosystem";
import type { LaxAccountConfig } from "../config";
import type { AccountLinksVm } from "./account-links";
import { ACCOUNT_ROUTES } from "./account-settings.vm";
import { PORTFOLIO_ROUTES } from "./portfolio-routes";
import { SELLING_ROUTES } from "./selling/selling-routes";

export type AccountNavId =
  | "home"
  | "personal-details"
  | "security"
  | "portfolio"
  | "money"
  | "selling"
  | "alerts"
  | "privacy"
  | "help";

export type AccountNavGroupId = "collection" | "account";

export const ACCOUNT_NAV_GROUP_LABEL: Record<AccountNavGroupId, string> = {
  collection: "Your collection",
  account: "Your account",
};

/** `group` is absent for Home and Help, which stand on their own at the top and the bottom. */
export type AccountNavItemVm = {
  id: AccountNavId;
  label: string;
  href: string;
  group?: AccountNavGroupId;
};

/** A run of menu items under one label; `label` is null for the items that stand alone. */
export type AccountNavSectionVm = {
  key: string;
  label: string | null;
  items: AccountNavItemVm[];
};

/** Splits the ordered menu into its sections: one per group, and the ungrouped items on their own. */
export function groupAccountNav(items: readonly AccountNavItemVm[]): AccountNavSectionVm[] {
  const sections: AccountNavSectionVm[] = [];
  for (const item of items) {
    const key = item.group ?? "ungrouped";
    const last = sections[sections.length - 1];
    if (item.group && last?.key === key) last.items.push(item);
    else if (!item.group && last && last.label === null) last.items.push(item);
    else
      sections.push({
        key: item.group ? key : `${key}-${item.id}`,
        label: item.group ? ACCOUNT_NAV_GROUP_LABEL[item.group] : null,
        items: [item],
      });
  }
  return sections;
}

/**
 * The signed-in menu, in the order a person looks for things. Selling is there only for people
 * who sell or are paid for sales (`selling`), so a buyer never sees it. Help opens Bid's
 * published help centre, so it is left out when Bid is not configured, as on the Home shortcuts.
 */
export function buildAccountNav(
  links: Pick<AccountLinksVm, "support">,
  options: { selling?: boolean } = {},
): AccountNavItemVm[] {
  const items: AccountNavItemVm[] = [
    { id: "home", label: "Home", href: ACCOUNT_ROUTES.overview },
    { id: "portfolio", label: "Portfolio", href: PORTFOLIO_ROUTES.overview, group: "collection" },
    { id: "money", label: "Money", href: PORTFOLIO_ROUTES.money, group: "collection" },
    ...(options.selling
      ? [
          {
            id: "selling" as const,
            label: "Selling",
            href: SELLING_ROUTES.overview,
            group: "collection" as const,
          },
        ]
      : []),
    {
      id: "personal-details",
      label: "Personal details",
      href: ACCOUNT_ROUTES.profile,
      group: "account",
    },
    { id: "security", label: "Security", href: ACCOUNT_ROUTES.security, group: "account" },
    { id: "alerts", label: "Email alerts", href: ACCOUNT_ROUTES.alerts, group: "account" },
    { id: "privacy", label: "Privacy", href: ACCOUNT_ROUTES.privacy, group: "account" },
  ];
  if (links.support) items.push({ id: "help", label: "Help", href: ACCOUNT_ROUTES.help });
  return items;
}

/**
 * The LAX top bar on Account: lax.art, lax.shop and lax.bid, then LAX Account as the current
 * member. A product without a configured URL is left out rather than linking nowhere.
 */
export function buildProductBar(
  config: Pick<LaxAccountConfig, "bidPublicUrl" | "shopPublicUrl" | "laxArtPublicUrl">,
): LaxFamilyLinkVm[] {
  return buildLaxFamilyLinks({
    current: "account",
    hrefs: {
      bid: config.bidPublicUrl,
      art: config.laxArtPublicUrl,
      shop: config.shopPublicUrl,
      account: "/",
    },
  });
}

const startsWithPath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/**
 * The menu entry a path belongs to: the longest href that is the path or a parent of it, so the
 * Money page highlights Money rather than Portfolio, and a work's page highlights Portfolio.
 * Home matches only itself. Paths outside the menu (such as an email change) match nothing.
 */
export function activeAccountNavId(
  pathname: string,
  items: readonly AccountNavItemVm[],
): AccountNavId | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  let best: AccountNavItemVm | null = null;
  for (const item of items) {
    const matches = item.id === "home" ? path === item.href : startsWithPath(path, item.href);
    if (matches && (!best || item.href.length > best.href.length)) best = item;
  }
  return best?.id ?? null;
}
