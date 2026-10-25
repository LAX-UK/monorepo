import type {
  LegalPolicyBlock,
  LegalPolicyDocument,
  LegalPolicySection,
  LegalPolicyText,
} from "@auction/marketing-ui";
import type { ShopPolicySlug } from "./shop-policy-status";

/** Shop's policy pages use the shared LAX policy model (see `LegalPolicyDocument`). */
export type ShopPolicyText = LegalPolicyText;
export type ShopPolicyBlock = LegalPolicyBlock;
export type ShopPolicySection = LegalPolicySection;
export type ShopPolicyDocument = LegalPolicyDocument<ShopPolicySlug>;
