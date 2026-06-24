import { lotPriceDisplay } from "@/lib/lot-price-display";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";

const base: Pick<
  Lot,
  | "status"
  | "winnerId"
  | "currentPrice"
  | "auctionType"
  | "buyNowPrice"
  | "startingPrice"
  | "marketingDetails"
> = {
  status: "ended",
  winnerId: null,
  currentPrice: "5000.00",
  auctionType: "english",
  buyNowPrice: null,
  startingPrice: "1000.00",
  marketingDetails: { estimate: { low: "1000.00", high: "2000.00", currency: "GBP" } },
};

describe("lotPriceDisplay", () => {
  it("shows Sold for when hasWinner is true without buyer id", () => {
    expect(lotPriceDisplay({ ...base, hasWinner: true })).toEqual({
      label: "Sold for",
      value: "£5,000.00",
    });
  });

  it("shows Unsold when hasWinner is false", () => {
    expect(lotPriceDisplay({ ...base, hasWinner: false })).toEqual({
      label: "Unsold",
      value: "—",
    });
  });
});
