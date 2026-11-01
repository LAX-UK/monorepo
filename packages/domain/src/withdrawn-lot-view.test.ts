import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { toWithdrawnLotView } from "./withdrawn-lot-view.js";

const lot = {
  id: "lot-1",
  saleId: "sale-1",
  lotNumber: 3,
  title: "Harbour lights",
  description: "Oil on canvas",
  medium: "Oil",
  dimensions: "40 x 50 cm",
  images: ["a.jpg"],
  artistId: "artist-1",
  categoryId: "cat-1",
  auctionType: "english",
  startingPrice: "100.00",
  reservePrice: "500.00",
  buyNowPrice: null,
  currentPrice: "900.00",
  buyerPremiumRate: "0.25",
  minBidIncrement: "10.00",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 0,
  dutchLastDecrementAt: null,
  startTime: new Date("2026-10-01T10:00:00Z"),
  endTime: new Date("2026-10-31T10:00:00Z"),
  status: "cancelled",
  winnerId: "user-9",
  createdAt: new Date("2026-09-01T10:00:00Z"),
  updatedAt: new Date("2026-09-02T10:00:00Z"),
  marketingDetails: { estimate: { low: "1000", high: "2000", currency: "GBP" } },
} satisfies Lot;

describe("toWithdrawnLotView", () => {
  it("keeps what identifies the lot and says it is withdrawn", () => {
    expect(toWithdrawnLotView(lot)).toEqual({
      id: "lot-1",
      saleId: "sale-1",
      lotNumber: 3,
      title: "Harbour lights",
      description: "Oil on canvas",
      medium: "Oil",
      dimensions: "40 x 50 cm",
      images: ["a.jpg"],
      artistId: "artist-1",
      categoryId: "cat-1",
      auctionType: "english",
      status: "withdrawn",
    });
  });

  it("carries no price, estimate, timing, reserve or winner", () => {
    const json = JSON.stringify(toWithdrawnLotView(lot));
    for (const secret of ["900.00", "500.00", "1000", "user-9", "startTime", "reserve"]) {
      expect(json).not.toContain(secret);
    }
  });
});
