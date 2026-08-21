import { EmailVerificationBidCallout } from "@/components/bid/email-verification-bid-callout";
import { KycThresholdCallout } from "@/components/kyc";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

export const strictEligibilityPolicy: BidPolicy = {
  id: "strict-eligibility",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (!ctx.strictBidEligibilityEnabled || !ctx.user || ctx.user.role !== "client") {
      return { kind: "allow" };
    }
    const user = ctx.user;

    if (user.emailVerified !== true) {
      return {
        kind: "block",
        viewId: "email-verification-required",
        render: () => (
          <EmailVerificationBidCallout email={user.email} returnPath={ctx.loginNextPath} />
        ),
      };
    }

    if (user.kycStatus !== "approved") {
      return {
        kind: "block",
        viewId: "strict-kyc-required",
        render: () => (
          <KycThresholdCallout
            returnPath={ctx.loginNextPath}
            lotId={ctx.lot.id}
            feedback={ctx.kycBidGate?.feedback ?? null}
            strict
          />
        ),
      };
    }

    return { kind: "allow" };
  },
};
