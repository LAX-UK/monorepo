import { emailVerificationBidBlockerPresentation } from "@/lib/bid/presenters/email-verification-blocker.presenter";
import { resolveKycBidBlockerPresentation } from "@/lib/bid/presenters/kyc-blocker.presenter";
import { contextualIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { evaluateSelfServiceActorIdentityEligibility } from "@auction/domain";
import { blockBid } from "./block-decision";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

export const strictEligibilityPolicy: BidPolicy = {
  id: "strict-eligibility",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (!ctx.strictBidEligibilityEnabled || !ctx.user || ctx.user.role !== "client") {
      return { kind: "allow" };
    }
    const user = ctx.user;
    const outcome = evaluateSelfServiceActorIdentityEligibility({
      emailVerified: user.emailVerified === true,
      kycStatus: user.kycStatus ?? "unverified",
    });

    if (outcome.kind === "eligible") {
      return { kind: "allow" };
    }

    if (outcome.code === "email_not_verified") {
      return blockBid(
        "email-verification-required",
        emailVerificationBidBlockerPresentation(user.email ?? "", ctx.loginNextPath),
      );
    }

    return blockBid(
      "strict-kyc-required",
      resolveKycBidBlockerPresentation({
        href: contextualIdentityOnboardingHref(ctx.loginNextPath, "bid_gate", ctx.lot.id),
        strict: true,
        feedback: ctx.kycBidGate?.feedback ?? null,
      }),
    );
  },
};
