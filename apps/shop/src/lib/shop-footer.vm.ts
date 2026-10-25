import { SHOP_HELP_LINK, SHOP_POLICY_LINKS } from "@/content/footer-nav.config";
import type { ShopPolicySlug } from "@/content/policies/shop-policy-status";
import { SHOP_ORDERS_HREF } from "@/lib/account/shop-account-routes";
import { laxAccountUrl } from "@/lib/lax-account-url";
import type { ShopFooterAccountState } from "@/lib/shop-footer-account-state";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { LAX_ART_LEGAL_INDEX, type MarketingFooterColumn } from "@auction/marketing-ui";

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
 * the shell). Legal lists the London Art Exchange Ltd policies Shop publishes, then lax.art's legal index.
 */
export function buildShopFooterVm(input: {
  crossProductLinks: readonly LaxProductLinkVm[];
  accountState: ShopFooterAccountState;
  /** Policy pages that can be linked on this deployment; drafts hidden on production are left out. */
  linkablePolicies: readonly ShopPolicySlug[];
}): ShopFooterVm {
  const policyLinks = (links: readonly { slug: ShopPolicySlug; label: string; href: string }[]) =>
    links
      .filter((link) => input.linkablePolicies.includes(link.slug))
      .map(({ label, href }) => ({ label, href }));
  const columns: MarketingFooterColumn[] = [
    {
      id: "shop",
      title: "Shop",
      links: [
        { label: "Artworks", href: "/artworks" },
        { label: "Artists", href: "/artists" },
        { label: "Categories", href: "/categories" },
        { label: "Basket", href: "/basket" },
        ...policyLinks([SHOP_HELP_LINK]),
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
  const artLink = input.crossProductLinks.find((link) => link.id === "art");
  const legalLinks = [
    ...policyLinks(SHOP_POLICY_LINKS),
    // The full list, including policies Shop does not publish itself, is lax.art's legal index.
    ...(artLink
      ? [{ label: LAX_ART_LEGAL_INDEX.title, href: new URL("/legal", artLink.href).toString() }]
      : []),
  ];
  if (legalLinks.length > 0) {
    columns.push({ id: "legal", title: "Legal", links: legalLinks });
  }
  return { columns };
}
