import { blockBid } from "./block-decision";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

export const unsupportedModePolicy: BidPolicy = {
  id: "unsupported-mode",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (!ctx.unsupportedAuctionMode) {
      return { kind: "allow" };
    }
    return blockBid("unsupported-auction-mode", {
      tone: "neutral",
      title: "Online bidding unavailable",
      detail:
        "Self-service bidding is only available for English and buy-now lots in this catalogue.",
      action: {
        kind: "link",
        href: "/contact",
        label: "Contact the saleroom",
        shortLabel: "Contact",
      },
    });
  },
};
