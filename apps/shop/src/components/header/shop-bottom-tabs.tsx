import {
  MarketingBagIcon,
  type MarketingBottomTab,
  MarketingGridIcon,
  MarketingHomeIcon,
  MarketingSearchIcon,
  MarketingUserIcon,
} from "@auction/marketing-ui";

/** Routes the Shop tab is current on: the catalogue, categories, artists and merchandise. */
export const SHOP_TAB_PATHS = ["/artworks", "/categories", "/artists", "/merchandise"] as const;

/** Routes with no bottom bar: the person is paying, and the page owns the bottom of the screen. */
const NO_BOTTOM_BAR_PREFIXES = ["/checkout"] as const;

/** True on checkout and payment routes, where the bottom bar is not drawn at all. */
export function shopBottomBarHidden(pathname: string): boolean {
  const path = pathname.split(/[?#]/)[0] ?? "";
  return NO_BOTTOM_BAR_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export type ShopBottomTabsInput = {
  /** Total quantity in the basket; works for guests. */
  basketCount: number;
  /** An order needs the person (for example an unpaid checkout still reserved). */
  accountNeedsAction: boolean;
  signedIn: boolean;
  /** Where the Account tab goes when signed out: Sign in, returning to the current page. */
  signInHref: string;
};

/** The five tabs: Home, Shop, Search, Basket, Account. */
export function buildShopBottomTabs({
  basketCount,
  accountNeedsAction,
  signedIn,
  signInHref,
}: ShopBottomTabsInput): MarketingBottomTab[] {
  const count = Number.isFinite(basketCount) ? Math.max(0, Math.floor(basketCount)) : 0;
  return [
    { key: "home", label: "Home", href: "/", paths: ["/"], icon: <MarketingHomeIcon /> },
    {
      key: "shop",
      label: "Shop",
      href: "/artworks",
      paths: SHOP_TAB_PATHS,
      icon: <MarketingGridIcon />,
    },
    { key: "search", label: "Search", action: "search", paths: [], icon: <MarketingSearchIcon /> },
    {
      key: "basket",
      label: "Basket",
      href: "/basket",
      paths: ["/basket"],
      icon: <MarketingBagIcon />,
      badge: count > 0 ? { kind: "count", count } : null,
    },
    {
      key: "account",
      label: "Account",
      href: signedIn ? "/account" : signInHref,
      paths: ["/account"],
      icon: <MarketingUserIcon />,
      badge: signedIn && accountNeedsAction ? { kind: "dot" } : null,
    },
  ];
}
