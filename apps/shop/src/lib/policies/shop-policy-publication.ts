import {
  type ShopPolicyRelease,
  type ShopPolicySlug,
  isProductionDeployEnv,
} from "@/content/policies/shop-policy-status";
import { SHOP_PRODUCTION_HOSTS } from "@/lib/seo/shop-indexing";
import { type LegalPolicyVisibility, resolveLegalPolicyVisibility } from "@auction/marketing-ui";

export type ShopPolicyVisibility = LegalPolicyVisibility;

/**
 * Production is the launch host or an image built for prod. Either one is enough, so a draft
 * stays hidden even if one signal is misconfigured. `SHOP_ALLOW_INDEXING` is deliberately not
 * a signal: production may be unindexed before launch.
 */
export function isShopProductionDeployment(input: {
  storefrontHost: string;
  deployEnv: string | undefined;
}): boolean {
  const host = input.storefrontHost.split(":")[0]?.trim().toLowerCase() ?? "";
  return SHOP_PRODUCTION_HOSTS.has(host) || isProductionDeployEnv(input.deployEnv);
}

/** Approved pages publish everywhere; drafts show with a banner off production and 404 on it. */
export function resolveShopPolicyVisibility(
  release: ShopPolicyRelease,
  production: boolean,
): ShopPolicyVisibility {
  return resolveLegalPolicyVisibility(release, production);
}

/**
 * Policy pages that may be linked to (footer, checkout). A draft hidden on production is left
 * out, so nothing links to a page that would 404.
 */
export function linkableShopPolicies(
  releases: Readonly<Record<ShopPolicySlug, ShopPolicyRelease>>,
  production: boolean,
): ShopPolicySlug[] {
  return (Object.keys(releases) as ShopPolicySlug[]).filter(
    (slug) => resolveShopPolicyVisibility(releases[slug], production) !== "hidden",
  );
}

/** The checkout terms line links to both pages, so it shows only when both can be linked. */
export function canShowCheckoutTerms(linkable: readonly ShopPolicySlug[]): boolean {
  return linkable.includes("terms") && linkable.includes("returns");
}
