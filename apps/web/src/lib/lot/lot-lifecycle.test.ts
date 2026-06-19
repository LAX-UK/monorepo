import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  classifyLotLifecycle,
  lifecycleBadge,
  saleroomOnBlockBadge,
  saleroomOnBlockRingClass,
} from "./lot-lifecycle";

const hour = 60 * 60 * 1000;

function lotBase(status: Lot["status"], over: Partial<Lot> = {}): Lot {
  const now = Date.now();
  return {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 1,
    sellerLegalEntityId: "le-1",
    title: "Test lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "cat",
    auctionType: "english",
    startingPrice: "100",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100",
    buyerPremiumRate: "0.25",
    minBidIncrement: "10",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date(now + hour),
    endTime: new Date(now + 2 * hour),
    status,
    winnerId: null,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    marketingDetails: {},
    ...over,
  } as Lot;
}

const onlineSale = { status: "scheduled" as const, deliveryMode: "online" as const };
const draftSale = { status: "draft" as const, deliveryMode: "online" as const };

describe("classifyLotLifecycle", () => {
  it("returns preLaunch for draft lot", () => {
    const l = lotBase("draft");
    expect(classifyLotLifecycle(l, onlineSale, Date.now()).kind).toBe("preLaunch");
  });

  it("returns preLaunch when sale is draft and lot is scheduled", () => {
    const l = lotBase("scheduled");
    expect(classifyLotLifecycle(l, draftSale, Date.now()).kind).toBe("preLaunch");
  });

  it("returns scheduled before start", () => {
    const t = Date.now();
    const l = lotBase("scheduled", {
      startTime: new Date(t + 2 * hour),
      endTime: new Date(t + 4 * hour),
    });
    const r = classifyLotLifecycle(l, onlineSale, t);
    expect(r.kind).toBe("scheduled");
    expect(r.msLeft).toBeGreaterThan(0);
  });

  it("returns live when active and between start and end", () => {
    const t = Date.now();
    const l = lotBase("active", {
      startTime: new Date(t - hour),
      endTime: new Date(t + hour),
    });
    const r = classifyLotLifecycle(l, onlineSale, t);
    expect(r.kind).toBe("live");
    expect(r.msLeft).toBeGreaterThan(0);
  });

  it("returns extended when recentlyExtended opt is true", () => {
    const t = Date.now();
    const l = lotBase("active", {
      startTime: new Date(t - hour),
      endTime: new Date(t + hour),
    });
    const r = classifyLotLifecycle(l, onlineSale, t, { recentlyExtended: true });
    expect(r.kind).toBe("extended");
  });

  it("returns saleroomPaused when saleroom session is paused on hybrid sale", () => {
    const t = Date.now();
    const l = lotBase("active", {
      startTime: new Date(t - hour),
      endTime: new Date(t + hour),
    });
    const hybridSale = { status: "active" as const, deliveryMode: "hybrid" as const };
    const r = classifyLotLifecycle(l, hybridSale, t, { saleroomSessionPaused: true });
    expect(r.kind).toBe("saleroomPaused");
    expect(r.msLeft).toBeNull();
  });

  it("returns liveSaleroom when saleroom session is live on hybrid sale", () => {
    const t = Date.now();
    const l = lotBase("active", {
      startTime: new Date(t - hour),
      endTime: new Date(t + hour),
    });
    const hybridSale = {
      status: "active" as const,
      deliveryMode: "hybrid" as const,
      allowOnlineBidsBeforeGoLive: false,
    };
    const r = classifyLotLifecycle(l, hybridSale, t, { saleroomSessionActive: true });
    expect(r.kind).toBe("liveSaleroom");
    expect(r.msLeft).toBeNull();
  });

  it("returns liveSaleroom for gated hybrid before Go Live", () => {
    const t = Date.now();
    const l = lotBase("active", {
      startTime: new Date(t - hour),
      endTime: new Date(t + hour),
    });
    const hybridSale = {
      status: "active" as const,
      deliveryMode: "hybrid" as const,
      allowOnlineBidsBeforeGoLive: false,
    };
    const r = classifyLotLifecycle(l, hybridSale, t);
    expect(r.kind).toBe("liveSaleroom");
  });

  it("returns live for open hybrid before Go Live", () => {
    const t = Date.now();
    const l = lotBase("active", {
      startTime: new Date(t - hour),
      endTime: new Date(t + hour),
    });
    const hybridSale = {
      status: "active" as const,
      deliveryMode: "hybrid" as const,
      allowOnlineBidsBeforeGoLive: true,
    };
    const r = classifyLotLifecycle(l, hybridSale, t);
    expect(r.kind).toBe("live");
  });

  it("returns endedSold when ended with winner", () => {
    const l = lotBase("ended", { winnerId: "u1" });
    expect(classifyLotLifecycle(l, onlineSale, Date.now()).kind).toBe("endedSold");
  });

  it("returns endedNoSale when ended without winner", () => {
    const l = lotBase("ended", { winnerId: null });
    expect(classifyLotLifecycle(l, onlineSale, Date.now()).kind).toBe("endedNoSale");
  });

  it("returns cancelled", () => {
    const l = lotBase("cancelled");
    expect(classifyLotLifecycle(l, onlineSale, Date.now()).kind).toBe("cancelled");
  });

  it("returns withdrawn for voided", () => {
    const l = lotBase("voided");
    expect(classifyLotLifecycle(l, onlineSale, Date.now()).kind).toBe("withdrawn");
  });
});

describe("lifecycleBadge", () => {
  it("maps live to pulsing live tone", () => {
    const b = lifecycleBadge({ kind: "live", msLeft: 1000 });
    expect(b.label).toMatch(/live/i);
    expect(b.pulse).toBe(true);
    expect(b.tone).toBe("live");
  });
});

describe("saleroomOnBlockBadge", () => {
  it("returns live tone with pulse dot", () => {
    expect(saleroomOnBlockBadge()).toEqual({
      label: "On the block",
      tone: "live",
      pulse: true,
    });
  });
});

describe("saleroomOnBlockRingClass", () => {
  it("uses live-red ring accent", () => {
    expect(saleroomOnBlockRingClass).toContain("ring-live-red");
  });
});
