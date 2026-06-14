import type { LotLifecycleKind } from "@/lib/lot/lot-lifecycle";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

function lifecycleBlockMessage(kind: LotLifecycleKind): string | null {
  switch (kind) {
    case "preLaunch":
      return "Bidding is not open yet — this is a catalogue preview.";
    case "scheduled":
      return "Bidding has not started — you can place bids once this lot goes live.";
    case "endedSold":
      return "This lot has sold — bidding is closed.";
    case "endedNoSale":
      return "This lot closed without a sale — bidding is closed.";
    case "cancelled":
      return "This lot was cancelled — bidding is closed.";
    case "withdrawn":
      return "This lot was withdrawn — bidding is closed.";
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
    if (life != null && life !== "live" && life !== "extended") {
      const msg = lifecycleBlockMessage(life);
      if (msg) {
        return {
          kind: "block",
          viewId: `not-live:${life}`,
          render: () => <p className="font-body text-secondary">{msg}</p>,
        };
      }
    }

    if (ctx.lotStatus === "active") {
      return { kind: "allow" };
    }
    return {
      kind: "block",
      viewId: "not-live",
      render: () => <p className="font-body text-secondary">This auction is not accepting bids.</p>,
    };
  },
};
