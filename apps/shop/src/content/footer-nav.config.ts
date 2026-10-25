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

/** London Art Exchange Ltd's privacy notice and cookie policy, which cover LAX Shop and lax.art. */
export const SHOP_PRIVACY_LINKS: readonly ShopPolicyLink[] = [
  { slug: "privacy", label: "Privacy notice", href: SHOP_POLICY_PATHS.privacy },
  { slug: "cookies", label: "Cookie policy", href: SHOP_POLICY_PATHS.cookies },
];
