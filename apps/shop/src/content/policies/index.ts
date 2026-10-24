import { DELIVERY_AND_COLLECTION } from "./delivery";
import { HELP_AND_CONTACT } from "./help";
import { CANCELLATIONS_AND_RETURNS } from "./returns";
import { SHOP_POLICY_PATHS, SHOP_POLICY_RELEASES, type ShopPolicySlug } from "./shop-policy-status";
import type { ShopPolicyDocument } from "./shop-policy.types";
import { TERMS_OF_SALE } from "./terms-of-sale";

export const SHOP_POLICY_DOCUMENTS: Readonly<Record<ShopPolicySlug, ShopPolicyDocument>> = {
  terms: TERMS_OF_SALE,
  delivery: DELIVERY_AND_COLLECTION,
  returns: CANCELLATIONS_AND_RETURNS,
  help: HELP_AND_CONTACT,
};

export { SHOP_POLICY_PATHS, SHOP_POLICY_RELEASES };
export type { ShopPolicySlug };
export type { ShopPolicyBlock, ShopPolicyDocument, ShopPolicySection } from "./shop-policy.types";
