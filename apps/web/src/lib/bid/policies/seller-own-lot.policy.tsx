import { SellerOwnLotNotice } from "@/components/marketing/seller-own-lot-notice";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

export const sellerOwnLotPolicy: BidPolicy = {
  id: "seller-own-lot",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (!ctx.user || ctx.user.id !== ctx.lot.sellerId) {
      return { kind: "allow" };
    }
    return {
      kind: "block",
      viewId: "seller-own-lot",
      render: () => <SellerOwnLotNotice />,
    };
  },
};
