import { isAdminBuyerBlocked } from "@/lib/presenters/viewer-participation";
import { ADMIN_CANNOT_BUY_DESCRIPTION, ADMIN_CANNOT_BUY_TITLE } from "@/lib/ui/admin-cannot-buy";
import { blockBid } from "./block-decision";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

export const adminPolicy: BidPolicy = {
  id: "admin",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (!ctx.user || !isAdminBuyerBlocked(ctx.user)) {
      return { kind: "allow" };
    }
    return blockBid("staff-no-bid", {
      tone: "info",
      title: ADMIN_CANNOT_BUY_TITLE,
      detail: ADMIN_CANNOT_BUY_DESCRIPTION,
      action: { kind: "link", href: "/admin", label: "Go to admin", shortLabel: "Admin" },
    });
  },
};
