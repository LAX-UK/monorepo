import { KycThresholdCallout } from "@/components/kyc";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "@/lib/bid/policies/types";

export const kycThresholdPolicy: BidPolicy = {
  id: "kyc-threshold",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (!ctx.user || !ctx.kycBidGate?.requiresKyc) {
      return { kind: "allow" };
    }
    return {
      kind: "block",
      viewId: "kyc-threshold",
      render: () => <KycThresholdCallout returnPath={ctx.loginNextPath} />,
    };
  },
};
