import { blockBid } from "./block-decision";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

export const sellerOwnLotPolicy: BidPolicy = {
  id: "seller-own-lot",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    const legacySellerMatch = Boolean(
      ctx.user && ctx.lot.sellerId && ctx.user.id === ctx.lot.sellerId,
    );
    if (!ctx.isOwnLot && !legacySellerMatch) {
      return { kind: "allow" };
    }
    return blockBid("seller-own-lot", {
      tone: "warning",
      title: "This is your listing",
      detail: "You can’t bid on a lot you’re selling. Watch bids arrive in the history below.",
      action: { kind: "status", label: "Your listing" },
    });
  },
};
