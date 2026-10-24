import { SHOP_ORDERS_HREF } from "@/lib/account/shop-account-routes";
import {
  type ShopSellerAccess,
  type ShopSellerTool,
  showsSellerTool,
} from "@/lib/account/shop-seller-access";

export type ShopAccountNavItem = {
  href: string;
  label: string;
  active: boolean;
};

const SELLER_TOOLS: ReadonlyArray<{ tool: ShopSellerTool; href: string; label: string }> = [
  { tool: "sales", href: "/account/sales", label: "Sales" },
  { tool: "payouts", href: "/account/payouts", label: "Payouts" },
  { tool: "sale-limits", href: "/account/sale-limits", label: "Sale limits" },
  { tool: "artworks", href: "/account/artworks", label: "My artworks" },
  { tool: "artist-sales", href: "/account/artist-sales", label: "Artist sales" },
];

export type BuildShopAccountNavItemsInput = {
  access: ShopSellerAccess;
  activeHref: string;
};

/**
 * "Your orders" plus the seller tools this viewer holds a role for. A plain buyer gets an empty
 * list: with one destination there is nothing to navigate between.
 */
export function buildShopAccountNavItems({
  access,
  activeHref,
}: BuildShopAccountNavItemsInput): ShopAccountNavItem[] {
  const tools = SELLER_TOOLS.filter(({ tool }) => showsSellerTool(access, tool));
  if (tools.length === 0) return [];
  return [{ href: SHOP_ORDERS_HREF, label: "Your orders" }, ...tools].map(({ href, label }) => ({
    href,
    label,
    active: activeHref === href,
  }));
}
