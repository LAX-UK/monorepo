import { describe, expect, it } from "vitest";
import { notLivePolicy } from "./not-live.policy";
import type { BidPolicyContext } from "./types";

const base = (): BidPolicyContext => ({
  user: { id: "u1", email: "a@b.c", name: "A", role: "client" },
  lot: {
    id: "l1",
    saleId: null,
    lotNumber: 1,
    sellerId: "s1",
    title: "T",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "c",
    auctionType: "english",
    startingPrice: "1",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "1",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date(),
    endTime: new Date(),
    status: "ended",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
  },
  lotStatus: "ended",
  loginNextPath: "/lot/test-lot/l1",
});

describe("notLivePolicy", () => {
  it("blocks when lotStatus is not active", () => {
    const d = notLivePolicy.evaluate(base());
    expect(d.kind).toBe("block");
    if (d.kind !== "block") return;
    expect(d.viewId).toBe("not-live");
    expect(d.presentation.tone).toBe("neutral");
    expect(d.presentation.title).toBe("Bidding unavailable");
    expect(d.presentation.action).toMatchObject({ kind: "status", label: "Unavailable" });
  });

  it("allows when lotStatus is active", () => {
    const d = notLivePolicy.evaluate({ ...base(), lotStatus: "active" });
    expect(d.kind).toBe("allow");
  });

  it("blocks with lifecycle copy when biddingLifecycle is preLaunch", () => {
    const d = notLivePolicy.evaluate({
      ...base(),
      lotStatus: "scheduled",
      biddingLifecycle: { kind: "preLaunch" },
    });
    expect(d.kind).toBe("block");
    if (d.kind !== "block") return;
    expect(d.viewId).toBe("not-live:preLaunch");
    expect(d.presentation.tone).toBe("neutral");
    expect(d.presentation.title).toBe("Catalogue preview");
    expect(d.presentation.action).toMatchObject({ kind: "status" });
    expect(d.presentation.preview).toBeDefined();
  });

  it("allows live lifecycle when lot is active", () => {
    const d = notLivePolicy.evaluate({
      ...base(),
      lotStatus: "active",
      biddingLifecycle: { kind: "live" },
    });
    expect(d.kind).toBe("allow");
  });

  it("blocks liveSaleroom when lot is not on block", () => {
    const d = notLivePolicy.evaluate({
      ...base(),
      lotStatus: "active",
      biddingLifecycle: { kind: "liveSaleroom", isOnBlock: false },
    });
    expect(d.kind).toBe("block");
    if (d.kind !== "block") return;
    expect(d.viewId).toBe("not-live:off-block");
    expect(d.presentation.tone).toBe("neutral");
    expect(d.presentation.title).toBe("Waiting for this lot");
    expect(d.presentation.action).toMatchObject({ kind: "status", label: "Not on block" });
  });

  it("allows liveSaleroom when lot is on block", () => {
    const d = notLivePolicy.evaluate({
      ...base(),
      lotStatus: "active",
      biddingLifecycle: { kind: "liveSaleroom", isOnBlock: true },
    });
    expect(d.kind).toBe("allow");
  });

  it("blocks when saleroom is paused", () => {
    const d = notLivePolicy.evaluate({
      ...base(),
      lotStatus: "active",
      biddingLifecycle: { kind: "saleroomPaused" },
    });
    expect(d.kind).toBe("block");
    if (d.kind !== "block") return;
    expect(d.viewId).toBe("not-live:saleroomPaused");
    expect(d.presentation.tone).toBe("warning");
    expect(d.presentation.title).toBe("Auction paused");
    expect(d.presentation.action).toMatchObject({ kind: "status", label: "Paused" });
  });
});
