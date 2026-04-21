import type { Lot } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PastAuctionCard } from "./past-auction-card";

const auction: Lot = {
  id: "a1",
  saleId: null,
  lotNumber: 1,
  sellerId: "s1",
  title: "Past work",
  description: null,
  medium: null,
  dimensions: null,
  images: [],
  categoryId: "c",
  auctionType: "english",
  startingPrice: "1",
  reservePrice: null,
  buyNowPrice: null,
  currentPrice: "500",
  buyerPremiumRate: "0.25",
  minBidIncrement: "1",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 0,
  dutchLastDecrementAt: null,
  startTime: new Date("2020-01-01"),
  endTime: new Date("2020-02-01"),
  status: "ended",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: {},
};

describe("PastAuctionCard", () => {
  it("shows owner badge when isOwner", () => {
    render(<PastAuctionCard auction={auction} sellerName="Artist" isOwner />);
    expect(screen.getByLabelText(/your listing/i)).toBeInTheDocument();
  });

  it("hides owner badge when not owner", () => {
    render(<PastAuctionCard auction={auction} sellerName="Artist" isOwner={false} />);
    expect(screen.queryByLabelText(/your listing/i)).not.toBeInTheDocument();
  });
});
