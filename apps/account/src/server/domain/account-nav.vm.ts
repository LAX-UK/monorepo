import type { LaxAccountConfig } from "../config";
import type { AccountLinksVm } from "./account-links";
import { ACCOUNT_ROUTES } from "./account-settings.vm";
import { PORTFOLIO_ROUTES } from "./portfolio-routes";

export type AccountNavId =
  | "home"
  | "personal-details"
  | "security"
  | "portfolio"
  | "money"
  | "privacy"
  | "help";

export type AccountNavItemVm = { id: AccountNavId; label: string; href: string };

/**
 * The signed-in menu, in the order a person looks for things. Help opens Bid's published help
 * centre, so it is left out when Bid is not configured, as on the Home shortcuts.
 */
export function buildAccountNav(links: Pick<AccountLinksVm, "support">): AccountNavItemVm[] {
  const items: AccountNavItemVm[] = [
    { id: "home", label: "Home", href: ACCOUNT_ROUTES.overview },
    { id: "personal-details", label: "Personal details", href: ACCOUNT_ROUTES.profile },
    { id: "security", label: "Security", href: ACCOUNT_ROUTES.security },
    { id: "portfolio", label: "Portfolio", href: PORTFOLIO_ROUTES.overview },
    { id: "money", label: "Money", href: PORTFOLIO_ROUTES.money },
    { id: "privacy", label: "Privacy", href: ACCOUNT_ROUTES.privacy },
  ];
  if (links.support) items.push({ id: "help", label: "Help", href: ACCOUNT_ROUTES.help });
  return items;
}

export type ProductBarItemVm = { id: string; label: string; href: string; current: boolean };

/**
 * The product bar above every header in the LAX family: Bid, Art, Shop, then this product,
 * which is the current one. A product without a configured URL is left out rather than linking
 * nowhere.
 */
export function buildProductBar(
  config: Pick<LaxAccountConfig, "bidPublicUrl" | "shopPublicUrl" | "laxArtPublicUrl">,
): ProductBarItemVm[] {
  const others: Array<[string, string, string | undefined]> = [
    ["bid", "LAX Bid", config.bidPublicUrl],
    ["art", "LAX Art", config.laxArtPublicUrl],
    ["shop", "LAX Shop", config.shopPublicUrl],
  ];
  return [
    ...others.flatMap(([id, label, href]) => (href ? [{ id, label, href, current: false }] : [])),
    { id: "account", label: "LAX Account", href: "/", current: true },
  ];
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
