import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  filterSaleLotsByLens,
  formatLotCurrentValue,
  formatLotEstimate,
  lotLiveStatusLabel,
  lotLiveStatusTone,
  resolveSaleLotsBoardMode,
} from "./sale-lots-tab.vm";

function makeLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    title: "Test lot",
    sellerLegalEntityId: "le-1",
    categoryIds: ["cat-1"],
    auctionType: "english",
    startingPrice: "100",
    artistId: null,
    startTime: new Date("2026-06-02T10:00:00Z"),
    endTime: new Date("2026-06-03T18:00:00Z"),
    saleId: "sale-1",
    lotNumber: 1,
    status: "draft",
    currentPrice: "100",
    images: [],
    marketingDetails: { estimate: null },
    sellerId: "seller-1",
    ...overrides,
  } as Lot;
}

const saleContext = {
  deliveryMode: "online" as const,
  startTime: new Date("2026-06-01T10:00:00Z"),
  endTime: new Date("2026-06-07T18:00:00Z"),
};

describe("sale-lots-tab.vm", () => {
  const lots = [
    makeLot({ id: "1", status: "active", title: "Blue Vase", lotNumber: 1, images: ["a"] }),
    makeLot({
      id: "2",
      status: "ended",
      title: "Red Chair",
      lotNumber: 2,
      winnerId: "u1",
      images: [],
    }),
    makeLot({ id: "3", status: "cancelled", title: "Green Lamp", lotNumber: 3, images: [] }),
  ];

  it("resolveSaleLotsBoardMode uses catalog for draft", () => {
    expect(resolveSaleLotsBoardMode("draft")).toBe("catalog");
    expect(resolveSaleLotsBoardMode("active")).toBe("live");
  });

  it("filterSaleLotsByLens live mode filters sold", () => {
    const sold = filterSaleLotsByLens(lots, "sold", saleContext, "live");
    expect(sold).toHaveLength(1);
    expect(sold[0]?.id).toBe("2");
  });

  it("formatLotEstimate and formatLotCurrentValue format values", () => {
    const lot = makeLot({
      currentPrice: "250",
      marketingDetails: {
        estimate: { low: "100", high: "200", currency: "GBP" },
      },
    });
    expect(formatLotEstimate(lot)).toMatch(/£100/);
    expect(formatLotCurrentValue(lot)).toMatch(/£250/);
  });

  it("lotLiveStatusLabel respects winner for ended lots", () => {
    expect(lotLiveStatusLabel("active")).toBe("Live");
    expect(lotLiveStatusLabel("ended", "user-1")).toBe("Sold");
    expect(lotLiveStatusLabel("ended", null)).toBe("Unsold");
    expect(lotLiveStatusTone("ended", "user-1")).toBe("sold");
    expect(lotLiveStatusTone("ended", null)).toBe("neutral");
  });
});
