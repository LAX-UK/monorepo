import type {
  LaxArtPolicySlug,
  LegalPolicyBlock,
  LegalPolicyDocument,
  LegalPolicySection,
  LegalPolicyText,
} from "@auction/marketing-ui";

/** Shop's policy pages use the shared LAX policy model (see `LegalPolicyDocument`). */
export type ShopPolicyText = LegalPolicyText;
export type ShopPolicyBlock = LegalPolicyBlock;
export type ShopPolicySection = LegalPolicySection;
/** A London Art Exchange Ltd policy, published on a Shop route (see `SHOP_POLICY_SOURCES`). */
export type ShopPolicyDocument = LegalPolicyDocument<LaxArtPolicySlug>;
