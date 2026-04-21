import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

export const notLivePolicy: BidPolicy = {
  id: "not-live",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (ctx.lotStatus === "active") {
      return { kind: "allow" };
    }
    return {
      kind: "block",
      viewId: "not-live",
      render: () => <p className="font-body text-secondary">This auction is not accepting bids.</p>,
    };
  },
};
