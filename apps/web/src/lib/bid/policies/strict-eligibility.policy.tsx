import {
  EmailVerificationBidCallout,
  emailVerificationBidBlockerPresentation,
} from "@/components/bid/email-verification-bid-callout";
import { KycThresholdCallout } from "@/components/kyc";
import { contextualIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { resolveKycBidBlockerPresentation } from "@/lib/kyc/kyc-bid-blocker-presentation";
import type { BidPolicy } from "./types";

export const strictEligibilityPolicy: BidPolicy = {
  id: "strict-eligibility",
  evaluate(ctx) {
    if (!ctx.strictBidEligibilityEnabled || !ctx.user || ctx.user.role !== "client") {
      return { kind: "allow" };
    }
    if (ctx.user.emailVerified !== true) {
      const email = ctx.user.email ?? "";
      const presentation = emailVerificationBidBlockerPresentation(email, ctx.loginNextPath);
      return {
        kind: "block",
        viewId: "email-verification-required",
        presentation,
        render: () => <EmailVerificationBidCallout email={email} returnPath={ctx.loginNextPath} />,
      };
    }
    if (ctx.user.kycStatus !== "approved") {
      const feedback = ctx.kycBidGate?.feedback ?? null;
      const presentation = resolveKycBidBlockerPresentation({
        href: contextualIdentityOnboardingHref(ctx.loginNextPath, "bid_gate", ctx.lot.id),
        strict: true,
        feedback,
      });
      return {
        kind: "block",
        viewId: "strict-kyc-required",
        presentation,
        render: () => (
          <KycThresholdCallout
            returnPath={ctx.loginNextPath}
            lotId={ctx.lot.id}
            feedback={feedback}
            strict
            presentation={presentation}
          />
        ),
      };
    }
    return { kind: "allow" };
  },
};
