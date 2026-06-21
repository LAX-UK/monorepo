import { saleListRow } from "@/lib/sale-list-row";
import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { parseLot } from "../../../lib/data/http/parse";
import { toEditorsPickLotCardVM, toHomeUpcomingAuctionTileVM } from "./home-view-models";

function baseLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    saleId: null,
    lotNumber: 1,
    title: "Test lot",
    description: null,
    medium: "Contemporary",
    dimensions: null,
    images: [],
    categoryId: "cat-1",
    auctionType: "english",
    startingPrice: "1000.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "1000.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: new Date("2026-06-01T12:00:00.000Z"),
    endTime: new Date("2026-06-02T12:00:00.000Z"),
    status: "scheduled",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
    ...overrides,
  };
}

function baseSale(overrides: Partial<Sale> = {}): Sale {
  const start = new Date("2026-09-10T10:00:00Z");
  return {
    id: "sale-1",
    title: "Autumn Sale",
    description: null,
    coverImages: [],
    categoryId: null,
    deliveryMode: "online",
    allowOnlineBidsBeforeGoLive: false,
    streamUrl: null,
    locationName: null,
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLine1: null,
    locationAddressLine2: null,
    locationCity: null,
    locationCounty: null,
    locationPostcode: null,
    locationCountry: null,
    status: "scheduled",
    startTime: start,
    endTime: new Date("2026-09-10T12:00:00Z"),
    previewStartTime: null,
    buyerPremiumRate: "0",
    buyerPremiumTiers: null,
    terms: null,
    createdAt: start,
    updatedAt: start,
    ...overrides,
  };
}

describe("toHomeUpcomingAuctionTileVM", () => {
  it("uses lotCount from the row instead of preview lots.length", () => {
    const previewLots = Array.from({ length: 4 }, (_, i) => ({ id: `l${i}` }) as Lot);
    const vm = toHomeUpcomingAuctionTileVM(saleListRow(baseSale(), previewLots, 15));
    expect(vm.lotCount).toBe(15);
  });

  it("falls back to lots.length when lotCount equals preview length", () => {
    const lots = [{ id: "l1" } as Lot, { id: "l2" } as Lot];
    const vm = toHomeUpcomingAuctionTileVM(saleListRow(baseSale(), lots, 2));
    expect(vm.lotCount).toBe(2);
  });
});

describe("toEditorsPickLotCardVM", () => {
  it("uses marketing estimate when present", () => {
    const vm = toEditorsPickLotCardVM(
      baseLot({
        marketingDetails: {
          estimate: { low: "50000", high: "75000", currency: "GBP" },
        },
      }),
    );
    expect(vm.estimateValue).toMatch(/£50,000\.00.*£75,000\.00/);
  });

  it("falls back to starting bid instead of rendering undefined", () => {
    const vm = toEditorsPickLotCardVM(
      baseLot({
        startingPrice: "2500.00",
        marketingDetails: {},
      }),
    );
    expect(vm.estimateValue).not.toBe("undefined");
    expect(vm.estimateValue).toMatch(/£2,500\.00/);
  });

  it("shows em dash when no estimate or price is available", () => {
    const vm = toEditorsPickLotCardVM(
      baseLot({
        startingPrice: "undefined",
        currentPrice: "undefined",
        marketingDetails: {},
      }),
    );
    expect(vm.estimateValue).toBe("—");
  });

  it("uses estimate from public list summary payload", () => {
    const lot = parseLot({
      id: "lot-1",
      saleId: "sale-1",
      lotNumber: 1,
      title: "2018 Patek Philippe Tiffany Nautilus Ref. 5711/1A-010",
      status: "active",
      currentPrice: "180000.00",
      startingPrice: "180000.00",
      auctionType: "english",
      medium: "Contemporary",
      startTime: "2026-06-01T12:00:00.000Z",
      endTime: "2026-06-18T20:00:00.000Z",
      images: [],
      marketingDetails: {
        estimate: { low: "180000.00", high: "220000.00", currency: "GBP" },
      },
    });
    const vm = toEditorsPickLotCardVM(lot);
    expect(vm.estimateValue).toMatch(/£180,000\.00.*£220,000\.00/);
    expect(vm.estimateValue).not.toBe("£0.00");
  });
});
