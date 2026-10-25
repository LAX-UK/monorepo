import { LAX_ART_POLICIES } from "@auction/marketing-ui";
import {
  SHOP_HELP_RELEASE,
  SHOP_POLICY_PATHS,
  SHOP_POLICY_RELEASES,
  SHOP_POLICY_SOURCES,
  type ShopPolicySlug,
  type ShopSourcedPolicySlug,
} from "./shop-policy-status";
import type { ShopPolicyDocument } from "./shop-policy.types";

const documentFor = (slug: ShopSourcedPolicySlug) =>
  LAX_ART_POLICIES[SHOP_POLICY_SOURCES[slug]].document;

/** London Art Exchange Ltd's policies on Shop routes; /help is built by `buildShopHelpDocument`. */
export const SHOP_POLICY_DOCUMENTS: Readonly<Record<ShopSourcedPolicySlug, ShopPolicyDocument>> = {
  terms: documentFor("terms"),
  delivery: documentFor("delivery"),
  returns: documentFor("returns"),
  privacy: documentFor("privacy"),
  cookies: documentFor("cookies"),
};

export { buildShopHelpDocument } from "./help";
export { SHOP_HELP_RELEASE, SHOP_POLICY_PATHS, SHOP_POLICY_RELEASES, SHOP_POLICY_SOURCES };
export type { ShopPolicySlug, ShopSourcedPolicySlug };
export type { ShopPolicyBlock, ShopPolicyDocument, ShopPolicySection } from "./shop-policy.types";
