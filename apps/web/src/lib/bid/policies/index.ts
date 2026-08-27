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

/** First matching block wins.
 * Terminal/platform restrictions, then sign-in and durable account restrictions,
 * then recoverable eligibility/registration, then connection.
 */
export const defaultBidPolicies: readonly BidPolicy[] = [
  notLivePolicy,
  unsupportedModePolicy,
  notSignedInPolicy,
  suspendedPolicy,
  sellerOwnLotPolicy,
  adminPolicy,
  strictEligibilityPolicy,
  kycThresholdPolicy,
  saleRegistrationPolicy,
  connectionPolicy,
] as const;

export type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";
