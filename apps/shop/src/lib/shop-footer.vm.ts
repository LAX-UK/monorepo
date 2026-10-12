import { buildShopPolicyLinks } from "@/content/footer-nav.config";
import type { ShopFooterAccountState } from "@/lib/shop-footer-account-state";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import type { MarketingFooterColumn } from "@auction/marketing-ui";

export type ShopFooterVm = {
  tagline: string;
  columns: MarketingFooterColumn[];
};

function accountColumnEntry(
  state: ShopFooterAccountState,
): Pick<MarketingFooterColumn, "links" | "note"> {
  switch (state.kind) {
    case "guest":
      return { links: [{ label: "Join us", href: "/register" }] };
    case "authenticated":
      return { links: [{ label: "Your account", href: "/account" }] };
    case "disabled":
      return { links: [{ label: "Account status", href: state.accountHref }] };
    case "unavailable":
      return { links: [], note: "Sign-in status unavailable" };
  }
}

/** Column order matches the Shop footer design: products, policies, shop, then socials. */
export function buildShopFooterVm(input: {
  crossProductLinks: readonly LaxProductLinkVm[];
  accountState: ShopFooterAccountState;
}): ShopFooterVm {
  const columns: MarketingFooterColumn[] = [];
  if (input.crossProductLinks.length > 0) {
    columns.push({
      id: "lax-products",
      title: "LAX products",
      links: input.crossProductLinks.map((link) => ({ label: link.label, href: link.href })),
    });
  }
  const bidLink = input.crossProductLinks.find((link) => link.id === "bid");
  if (bidLink) {
    columns.push({ id: "policies", title: "Policies", links: buildShopPolicyLinks(bidLink.href) });
  }
  const account = accountColumnEntry(input.accountState);
  columns.push({
    id: "shop",
    title: "Shop",
    links: [
      { label: "Artworks", href: "/artworks" },
      { label: "Artists", href: "/artists" },
      { label: "Categories", href: "/categories" },
      ...account.links,
    ],
    ...(account.note ? { note: account.note } : {}),
  });
  return {
    tagline: "Collect contemporary art editions from London Art Exchange.",
    columns,
  };
}
