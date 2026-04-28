import {
  AdminCannotBuyNotice,
  isAdminBuyerBlocked,
} from "@/components/marketing/admin-cannot-buy-notice";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

export const adminPolicy: BidPolicy = {
  id: "admin",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (!ctx.user || !isAdminBuyerBlocked(ctx.user)) {
      return { kind: "allow" };
    }
    return {
      kind: "block",
      viewId: "staff-no-bid",
      render: () => <AdminCannotBuyNotice />,
    };
  },
};
