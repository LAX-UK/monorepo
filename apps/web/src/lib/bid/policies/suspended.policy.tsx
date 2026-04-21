import { SuspendedNotice } from "@/components/marketing/suspended-notice";
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
    return {
      kind: "block",
      viewId: "suspended",
      render: () => <SuspendedNotice />,
    };
  },
};
