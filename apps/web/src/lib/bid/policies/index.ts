import { adminPolicy } from "./admin.policy";
import { connectionPolicy } from "./connection.policy";
import { kycThresholdPolicy } from "./kyc-threshold.policy";
import { notLivePolicy } from "./not-live.policy";
import { notSignedInPolicy } from "./not-signed-in.policy";
import { saleRegistrationPolicy } from "./sale-registration.policy";
import { sellerOwnLotPolicy } from "./seller-own-lot.policy";
import { strictEligibilityPolicy } from "./strict-eligibility.policy";
import { suspendedPolicy } from "./suspended.policy";
import type { BidPolicy } from "./types";
import { unsupportedModePolicy } from "./unsupported-mode.policy";

/** First matching block wins. `notLive` precedes `notSignedIn` so ended lots show
 * “not accepting bids” instead of a misleading sign-in CTA. Runtime catalogue and
 * connection blocks are ordinary policies so precedence stays in this array:
 * eligibility beats connection (connection is last), unsupported mode follows not-live.
 */
export const defaultBidPolicies: readonly BidPolicy[] = [
  notLivePolicy,
  unsupportedModePolicy,
  notSignedInPolicy,
  strictEligibilityPolicy,
  kycThresholdPolicy,
  saleRegistrationPolicy,
  suspendedPolicy,
  sellerOwnLotPolicy,
  adminPolicy,
  connectionPolicy,
] as const;

export type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";
