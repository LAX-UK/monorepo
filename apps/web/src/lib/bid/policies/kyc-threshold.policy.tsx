import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "@/lib/bid/policies/types";
import Link from "next/link";

export const kycThresholdPolicy: BidPolicy = {
  id: "kyc-threshold",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (!ctx.user || !ctx.kycBidGate?.requiresKyc) {
      return { kind: "allow" };
    }
    return {
      kind: "block",
      viewId: "kyc-threshold",
      render: () => (
        <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-4 text-center text-sm text-on-surface-variant">
          <p className="font-medium text-on-surface">Identity verification required</p>
          <p className="mt-2">
            Your bidding exposure has reached our verification threshold. Complete verification to
            place bids on this lot.
          </p>
          <p className="mt-3">
            <Link
              className="font-semibold text-primary underline underline-offset-2"
              href="/dashboard/verify-identity"
            >
              Verify identity
            </Link>
          </p>
        </div>
      ),
    };
  },
};
