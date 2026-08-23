import { blockBid } from "./block-decision";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

function isSuspended(user: NonNullable<BidPolicyContext["user"]>): boolean {
  return user.suspended === true;
}

export const suspendedPolicy: BidPolicy = {
  id: "suspended",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (!ctx.user || !isSuspended(ctx.user)) {
      return { kind: "allow" };
    }
    return blockBid("suspended", {
      tone: "danger",
      title: "Account suspended",
      detail: "Your account cannot place bids while it is suspended.",
      action: {
        kind: "link",
        href: "/contact",
        label: "Contact support",
        shortLabel: "Support",
      },
    });
  },
};
