import { KycThresholdCallout } from "@/components/kyc";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "@/lib/bid/policies/types";
import { contextualIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { resolveKycBidBlockerPresentation } from "@/lib/kyc/kyc-bid-blocker-presentation";

export const kycThresholdPolicy: BidPolicy = {
  id: "kyc-threshold",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (!ctx.user || !ctx.kycBidGate?.requiresKyc) {
      return { kind: "allow" };
    }
    const feedback = ctx.kycBidGate.feedback ?? null;
    const presentation = resolveKycBidBlockerPresentation({
      href: contextualIdentityOnboardingHref(ctx.loginNextPath, "bid_gate", ctx.lot.id),
      strict: false,
      feedback,
    });
    return {
      kind: "block",
      viewId: "kyc-threshold",
      presentation,
      render: () => (
        <KycThresholdCallout
          returnPath={ctx.loginNextPath}
          lotId={ctx.lot.id}
          feedback={feedback}
          presentation={presentation}
        />
      ),
    };
  },
};
