import { blockBid } from "./block-decision";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

export const connectionPolicy: BidPolicy = {
  id: "connection",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (!ctx.connectionBlocked) {
      return { kind: "allow" };
    }
    const offline = ctx.connectionState === "offline";
    return blockBid("connection-unavailable", {
      tone: "warning",
      title: "Live bidding temporarily unavailable",
      detail:
        ctx.connectionMessage ?? "Reconnect to the saleroom before placing or changing a bid.",
      action: {
        kind: "status",
        label: offline ? "Offline" : "Reconnecting",
        shortLabel: offline ? "Offline" : "Reconnecting",
      },
      preview:
        "Your one-time bid and auto-bid options will return when the connection is restored.",
    });
  },
};
