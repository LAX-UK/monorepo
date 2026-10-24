import {
  SHOP_HELP_LINK,
  SHOP_POLICY_LINKS,
  buildShopGroupPolicyLinks,
} from "@/content/footer-nav.config";
import { SHOP_ORDERS_HREF } from "@/lib/account/shop-account-routes";
import { laxAccountUrl } from "@/lib/lax-account-url";
import type { ShopFooterAccountState } from "@/lib/shop-footer-account-state";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import type { MarketingFooterColumn } from "@auction/marketing-ui";

export type ShopFooterVm = {
  columns: MarketingFooterColumn[];
};

function accountColumn(state: ShopFooterAccountState): MarketingFooterColumn {
  const column = { id: "account", title: "Account" };
  switch (state.kind) {
    case "guest":
      return {
        ...column,
        links: [
          { label: "Sign in", href: "/login" },
          { label: "Create account", href: "/register" },
        ],
      };
    case "authenticated":
      return {
        ...column,
        links: [
          { label: "Your orders", href: SHOP_ORDERS_HREF },
          { label: "LAX Account", href: laxAccountUrl() },
        ],
      };
    case "disabled":
      return { ...column, links: [{ label: "Account status", href: state.accountHref }] };
    case "unavailable":
      return { ...column, links: [], note: "Sign-in status unavailable" };
  }
}

/**
 * Shared LAX footer order: site navigation, account, LAX products, legal (Connect is appended by
 * the shell). Legal is Shop's own retail policies, then the group privacy and cookie policies.
 */
export function buildShopFooterVm(input: {
  crossProductLinks: readonly LaxProductLinkVm[];
  accountState: ShopFooterAccountState;
}): ShopFooterVm {
  const columns: MarketingFooterColumn[] = [
    {
      id: "shop",
      title: "Shop",
      links: [
        { label: "Artworks", href: "/artworks" },
        { label: "Artists", href: "/artists" },
        { label: "Categories", href: "/categories" },
        { label: "Basket", href: "/basket" },
        SHOP_HELP_LINK,
      ],
    },
    accountColumn(input.accountState),
  ];
  if (input.crossProductLinks.length > 0) {
    columns.push({
      id: "lax-products",
      title: "LAX products",
      links: input.crossProductLinks.map((link) => ({ label: link.label, href: link.href })),
    });
  }
  const bidLink = input.crossProductLinks.find((link) => link.id === "bid");
  columns.push({
    id: "legal",
    title: "Legal",
    links: [...SHOP_POLICY_LINKS, ...(bidLink ? buildShopGroupPolicyLinks(bidLink.href) : [])],
  });
  return { columns };
}
