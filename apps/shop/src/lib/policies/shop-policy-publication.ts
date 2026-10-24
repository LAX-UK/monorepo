import { isProductionDeployEnv } from "@/content/policies/shop-policy-status";
import type { ShopPolicyRelease } from "@/content/policies/shop-policy-status";
import { SHOP_PRODUCTION_HOSTS } from "@/lib/seo/shop-indexing";

export type ShopPolicyVisibility = "published" | "draft-preview" | "hidden";

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
  if (release.status === "approved") return "published";
  return production ? "hidden" : "draft-preview";
}
