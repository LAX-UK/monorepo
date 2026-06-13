import { toCatalogLotVM, toCatalogLotVMs } from "@/lib/lot/to-catalog-lot-vm";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";

const lot = {
  id: "lot-1",
  saleId: null,
  lotNumber: 1,
  title: "Test",
  description: null,
  medium: null,
  dimensions: null,
  images: [],
  categoryId: "cat-1",
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
  startTime: new Date("2026-01-01T00:00:00.000Z"),
  endTime: new Date("2026-01-02T00:00:00.000Z"),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: {},
} satisfies Lot;

describe("toCatalogLotVM", () => {
  it("normalizes timing once at the catalogue boundary", () => {
    expect(toCatalogLotVM(lot)).toMatchObject({
      id: "lot-1",
      status: "active",
      startTime: "2026-01-01T00:00:00.000Z",
      endTime: "2026-01-02T00:00:00.000Z",
    });
  });

  it("maps arrays via toCatalogLotVMs", () => {
    expect(toCatalogLotVMs([lot])).toHaveLength(1);
  });
});
