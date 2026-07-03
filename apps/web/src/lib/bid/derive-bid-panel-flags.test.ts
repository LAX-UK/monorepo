import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { deriveBidPanelFlags } from "./derive-bid-panel-flags";

const baseLot = (): Lot => ({
  id: "lot-1",
  saleId: null,
  lotNumber: 1,
  title: "Vase",
  description: null,
  medium: null,
  dimensions: null,
  images: [],
  categoryId: "c",
  auctionType: "english",
  startingPrice: "100",
  reservePrice: null,
  buyNowPrice: null,
  currentPrice: "100",
  buyerPremiumRate: "0.25",
  minBidIncrement: "10",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 60_000,
  dutchLastDecrementAt: null,
  startTime: new Date(),
  endTime: new Date(Date.now() + 86_400_000),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: {},
});

describe("deriveBidPanelFlags", () => {
  const switchEntryMode = vi.fn();

  it("marks auto-bid eligible when lot is live", () => {
    const flags = deriveBidPanelFlags({
      auction: baseLot(),
      position: { kind: "notBidding" },
      lifecycle: { kind: "live", msLeft: 1000 },
      countdownClock: "2h",
      isLotOnBlock: false,
      biddingLive: false,
      biddingAllowed: true,
      activeAutoBid: null,
      switchEntryMode,
    });
    expect(flags.autoBidEligible).toBe(true);
    expect(flags.showAutoBidExplainer).toBe(false);
  });

  it("shows scheduled explainer with countdown", () => {
    const flags = deriveBidPanelFlags({
      auction: baseLot(),
      position: { kind: "notBidding" },
      lifecycle: { kind: "scheduled", msLeft: 1000 },
      countdownClock: "2h",
      isLotOnBlock: false,
      biddingLive: false,
      biddingAllowed: true,
      activeAutoBid: null,
      switchEntryMode,
    });
    expect(flags.autoBidEligible).toBe(false);
    expect(flags.showAutoBidExplainer).toBe(true);
    expect(flags.autoBidExplainerText).toBe("Auto-bid opens when this lot goes live in 2h.");
  });

  it("uses saleroom-not-on-block explainer text", () => {
    const flags = deriveBidPanelFlags({
      auction: baseLot(),
      position: { kind: "notBidding" },
      lifecycle: { kind: "liveSaleroom", msLeft: 1000 },
      countdownClock: "",
      isLotOnBlock: false,
      biddingLive: false,
      biddingAllowed: true,
      activeAutoBid: null,
      switchEntryMode,
    });
    expect(flags.autoBidExplainerText).toBe(
      "Auto-bid opens when the auctioneer calls this lot on the block.",
    );
  });

  it("uses hybrid scheduled explainer when sale is hybrid", () => {
    const flags = deriveBidPanelFlags({
      auction: baseLot(),
      position: { kind: "notBidding" },
      lifecycle: { kind: "scheduled", msLeft: 1000 },
      countdownClock: "1h",
      isLotOnBlock: false,
      biddingLive: false,
      biddingAllowed: true,
      activeAutoBid: null,
      saleForLifecycle: { status: "scheduled", deliveryMode: "hybrid" },
      switchEntryMode,
    });
    expect(flags.autoBidExplainerText).toBe(
      "Auto-bid opens when the auctioneer starts the sale (1h until sale start).",
    );
  });

  it("flags connection blocked when live bidding is disallowed", () => {
    const flags = deriveBidPanelFlags({
      auction: baseLot(),
      position: { kind: "notBidding" },
      lifecycle: { kind: "live", msLeft: 1000 },
      countdownClock: "",
      isLotOnBlock: false,
      biddingLive: true,
      biddingAllowed: false,
      activeAutoBid: null,
      switchEntryMode,
    });
    expect(flags.connectionBlocked).toBe(true);
  });
});
