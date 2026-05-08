import { adminPolicy } from "./admin.policy";
import { notLivePolicy } from "./not-live.policy";
import { notSignedInPolicy } from "./not-signed-in.policy";
import { sellerOwnLotPolicy } from "./seller-own-lot.policy";
import { suspendedPolicy } from "./suspended.policy";
import type { BidPolicy } from "./types";

/** First matching block wins. `notLive` precedes `notSignedIn` so ended lots show
 * “not accepting bids” instead of a misleading sign-in CTA.
 */
export const defaultBidPolicies: readonly BidPolicy[] = [
  notLivePolicy,
  notSignedInPolicy,
  suspendedPolicy,
  sellerOwnLotPolicy,
  adminPolicy,
] as const;

export type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";
