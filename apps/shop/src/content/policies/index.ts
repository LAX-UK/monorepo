import { LAX_ART_POLICIES } from "@auction/marketing-ui";
import {
  SHOP_POLICY_PATHS,
  SHOP_POLICY_RELEASES,
  SHOP_POLICY_SOURCES,
  type ShopPolicySlug,
} from "./shop-policy-status";
import type { ShopPolicyDocument } from "./shop-policy.types";

const documentFor = (slug: ShopPolicySlug) => LAX_ART_POLICIES[SHOP_POLICY_SOURCES[slug]].document;

export const SHOP_POLICY_DOCUMENTS: Readonly<Record<ShopPolicySlug, ShopPolicyDocument>> = {
  terms: documentFor("terms"),
  delivery: documentFor("delivery"),
  returns: documentFor("returns"),
  help: documentFor("help"),
  privacy: documentFor("privacy"),
  cookies: documentFor("cookies"),
};

export { SHOP_POLICY_PATHS, SHOP_POLICY_RELEASES, SHOP_POLICY_SOURCES };
export type { ShopPolicySlug };
export type { ShopPolicyBlock, ShopPolicyDocument, ShopPolicySection } from "./shop-policy.types";
