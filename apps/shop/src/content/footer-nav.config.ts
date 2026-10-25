import { SHOP_POLICY_PATHS, type ShopPolicySlug } from "@/content/policies/shop-policy-status";

type ShopPolicyLink = { slug: ShopPolicySlug; label: string; href: string };

/** Shop's own retail policies: they apply to online orders, unlike Bid's auction conditions. */
export const SHOP_POLICY_LINKS: readonly ShopPolicyLink[] = [
  { slug: "terms", label: "Terms of sale", href: SHOP_POLICY_PATHS.terms },
  { slug: "delivery", label: "Delivery and collection", href: SHOP_POLICY_PATHS.delivery },
  { slug: "returns", label: "Cancellations and returns", href: SHOP_POLICY_PATHS.returns },
];

export const SHOP_HELP_LINK: ShopPolicyLink = {
  slug: "help",
  label: "Help and contact",
  href: SHOP_POLICY_PATHS.help,
};

/**
 * Privacy and cookies still link to the notices published on LAX Bid, which name Bid's operator.
 * LAX Shop (operated by London Art Exchange Ltd) needs its own before launch.
 */
const groupPolicyRoutes = [
  { label: "Privacy notice", pathname: "/privacy" },
  { label: "Cookie policy", pathname: "/cookies" },
] as const;

export function buildShopGroupPolicyLinks(bidBaseUrl: string) {
  return groupPolicyRoutes.map(({ label, pathname }) => ({
    label,
    href: new URL(pathname, bidBaseUrl).toString(),
  }));
}
