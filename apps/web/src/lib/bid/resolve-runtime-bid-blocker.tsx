import { blockBid } from "@/lib/bid/policies/block-decision";
import type { BidPolicyDecision } from "@/lib/bid/policies/types";
import type { LiveConnectionState } from "@/lib/connection/merge-connection-status";

type RuntimeBidBlockerInput = {
  policyDecision: BidPolicyDecision;
  unsupportedAuctionMode: boolean;
  connectionBlocked: boolean;
  connectionState: LiveConnectionState;
  connectionMessage?: string | null;
};

export function resolveRuntimeBidBlocker({
  policyDecision,
  unsupportedAuctionMode,
  connectionBlocked,
  connectionState,
  connectionMessage,
}: RuntimeBidBlockerInput): BidPolicyDecision {
  if (policyDecision.kind === "block") return policyDecision;

  if (unsupportedAuctionMode) {
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
  }

  if (connectionBlocked) {
    return blockBid("connection-unavailable", {
      tone: "warning",
      title: "Live bidding temporarily unavailable",
      detail: connectionMessage ?? "Reconnect to the saleroom before placing or changing a bid.",
      action: {
        kind: "status",
        label: connectionState === "offline" ? "Offline" : "Reconnecting",
        shortLabel: connectionState === "offline" ? "Offline" : "Reconnecting",
      },
      preview:
        "Your one-time bid and auto-bid options will return when the connection is restored.",
    });
  }

  return policyDecision;
}
