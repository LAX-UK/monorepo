import { blockBid } from "./block-decision";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

export const notSignedInPolicy: BidPolicy = {
  id: "not-signed-in",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (ctx.user !== null) {
      return { kind: "allow" };
    }
    const next = encodeURIComponent(ctx.loginNextPath);
    return blockBid("not-signed-in", {
      tone: "info",
      title: "Sign in to bid",
      detail: "Use your LAX account to place a bid on this lot.",
      action: {
        kind: "link",
        href: `/login?next=${next}`,
        label: "Sign in to continue",
        shortLabel: "Sign in",
      },
      preview: "After signing in, you can place a one-time bid or set an auto-bid on this lot.",
    });
  },
};
