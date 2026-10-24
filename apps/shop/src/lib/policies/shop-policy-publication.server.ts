import "server-only";

import { SHOP_POLICY_RELEASES, type ShopPolicySlug } from "@/content/policies";
import { loadShopEnv } from "@/env";
import { loadShopStorefrontBaseUrl } from "@/lib/ecosystem/product-directory.server";
import {
  type ShopPolicyVisibility,
  isShopProductionDeployment,
  resolveShopPolicyVisibility,
} from "@/lib/policies/shop-policy-publication";

export function loadShopPolicyVisibility(slug: ShopPolicySlug): ShopPolicyVisibility {
  const production = isShopProductionDeployment({
    storefrontHost: loadShopStorefrontBaseUrl().hostname,
    deployEnv: loadShopEnv().SHOP_DEPLOY_ENV,
  });
  return resolveShopPolicyVisibility(SHOP_POLICY_RELEASES[slug], production);
}
