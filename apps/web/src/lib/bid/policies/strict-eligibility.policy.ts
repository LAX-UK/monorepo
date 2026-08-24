import { emailVerificationBidBlockerPresentation } from "@/lib/bid/presenters/email-verification-blocker.presenter";
import { resolveKycBidBlockerPresentation } from "@/lib/bid/presenters/kyc-blocker.presenter";
import { contextualIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { blockBid } from "./block-decision";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

export const strictEligibilityPolicy: BidPolicy = {
  id: "strict-eligibility",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (!ctx.strictBidEligibilityEnabled || !ctx.user || ctx.user.role !== "client") {
      return { kind: "allow" };
    }
    const user = ctx.user;

    if (user.emailVerified !== true) {
      return blockBid(
        "email-verification-required",
        emailVerificationBidBlockerPresentation(user.email ?? "", ctx.loginNextPath),
      );
    }

    if (user.kycStatus !== "approved") {
      return blockBid(
        "strict-kyc-required",
        resolveKycBidBlockerPresentation({
          href: contextualIdentityOnboardingHref(ctx.loginNextPath, "bid_gate", ctx.lot.id),
          strict: true,
          feedback: ctx.kycBidGate?.feedback ?? null,
        }),
      );
    }

    return { kind: "allow" };
  },
};
