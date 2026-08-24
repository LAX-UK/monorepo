import { resolveKycBidBlockerPresentation } from "@/lib/bid/presenters/kyc-blocker.presenter";
import { contextualIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { blockBid } from "./block-decision";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

export const kycThresholdPolicy: BidPolicy = {
  id: "kyc-threshold",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (!ctx.user || !ctx.kycBidGate?.requiresKyc) {
      return { kind: "allow" };
    }
    return blockBid(
      "kyc-threshold",
      resolveKycBidBlockerPresentation({
        href: contextualIdentityOnboardingHref(ctx.loginNextPath, "bid_gate", ctx.lot.id),
        strict: false,
        feedback: ctx.kycBidGate.feedback ?? null,
      }),
    );
  },
};
