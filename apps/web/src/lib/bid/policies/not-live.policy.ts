import type { BidBlockerPresentation } from "@/lib/bid/bid-blocker-presentation";
import type { LotLifecycleKind } from "@/lib/lot/lot-lifecycle";
import { blockBid } from "./block-decision";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

const FUTURE_BIDDING_PREVIEW =
  "When bidding opens, you can place a one-time bid or set an auto-bid on this lot.";

function lifecycleBlockPresentation(kind: LotLifecycleKind): BidBlockerPresentation | null {
  switch (kind) {
    case "preLaunch":
      return {
        tone: "neutral",
        title: "Catalogue preview",
        detail: "Bidding is not open yet for this lot.",
        action: { kind: "status", label: "Not open yet" },
        preview: FUTURE_BIDDING_PREVIEW,
      };
    case "scheduled":
      return {
        tone: "neutral",
        title: "Bidding has not started",
        detail: "You can bid once the auctioneer starts the sale.",
        action: { kind: "status", label: "Scheduled" },
        preview: FUTURE_BIDDING_PREVIEW,
      };
    case "endedSold":
      return {
        tone: "neutral",
        title: "Lot sold",
        detail: "Bidding is closed for this lot.",
        action: { kind: "status", label: "Sold" },
      };
    case "endedNoSale":
      return {
        tone: "neutral",
        title: "Bidding closed",
        detail: "This lot closed without a sale.",
        action: { kind: "status", label: "Closed" },
      };
    case "cancelled":
      return {
        tone: "neutral",
        title: "Lot cancelled",
        detail: "Bidding is closed for this lot.",
        action: { kind: "status", label: "Cancelled" },
      };
    case "withdrawn":
      return {
        tone: "neutral",
        title: "Lot withdrawn",
        detail: "Bidding is closed for this lot.",
        action: { kind: "status", label: "Withdrawn" },
      };
    case "saleroomPaused":
      return {
        tone: "warning",
        title: "Auction paused",
        detail: "Bidding will resume when the auctioneer continues.",
        action: { kind: "status", label: "Paused" },
        preview: FUTURE_BIDDING_PREVIEW,
      };
    case "live":
    case "extended":
    case "liveSaleroom":
      return null;
  }
}

export const notLivePolicy: BidPolicy = {
  id: "not-live",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    const life = ctx.biddingLifecycle?.kind;
    if (life === "liveSaleroom" && !ctx.biddingLifecycle?.isOnBlock) {
      return blockBid("not-live:off-block", {
        tone: "neutral",
        title: "Waiting for this lot",
        detail: "Bidding opens when the auctioneer calls this lot on the block.",
        action: { kind: "status", label: "Not on block" },
        preview: FUTURE_BIDDING_PREVIEW,
      });
    }
    if (life != null && life !== "live" && life !== "extended") {
      const presentation = lifecycleBlockPresentation(life);
      if (presentation) {
        return blockBid(`not-live:${life}`, presentation);
      }
    }

    if (ctx.lotStatus === "active") {
      return { kind: "allow" };
    }
    return blockBid("not-live", {
      tone: "neutral",
      title: "Bidding unavailable",
      detail: "This auction is not accepting bids.",
      action: { kind: "status", label: "Unavailable" },
    });
  },
};
