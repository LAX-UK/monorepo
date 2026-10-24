import "server-only";

import { SHOP_POLICY_RELEASES, type ShopPolicySlug } from "@/content/policies/shop-policy-status";
import { loadShopEnv } from "@/env";
import { loadShopStorefrontBaseUrl } from "@/lib/ecosystem/product-directory.server";
import {
  type ShopPolicyVisibility,
  isShopProductionDeployment,
  linkableShopPolicies,
  resolveShopPolicyVisibility,
} from "@/lib/policies/shop-policy-publication";

function isProduction(): boolean {
  return isShopProductionDeployment({
    storefrontHost: loadShopStorefrontBaseUrl().hostname,
    deployEnv: loadShopEnv().SHOP_DEPLOY_ENV,
  });
}

export function loadShopPolicyVisibility(slug: ShopPolicySlug): ShopPolicyVisibility {
  return resolveShopPolicyVisibility(SHOP_POLICY_RELEASES[slug], isProduction());
}

/** Policy pages the footer and checkout may link to on this deployment. */
export function loadLinkableShopPolicies(): ShopPolicySlug[] {
  return linkableShopPolicies(SHOP_POLICY_RELEASES, isProduction());
}
