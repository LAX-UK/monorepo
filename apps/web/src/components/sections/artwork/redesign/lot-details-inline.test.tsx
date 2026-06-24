import { LotDetailsInline } from "@/components/sections/artwork/redesign/lot-details-inline";
import type { PublicLotView } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const publicLot: PublicLotView = {
  id: "lot-1",
  saleId: "sale-1",
  lotNumber: 12,
  sellerId: "seller-1",
  title: "Untitled",
  description: "A painting",
  medium: "oil on canvas",
  dimensions: "50 × 60 cm",
  images: [],
  categoryId: "cat-1",
  auctionType: "english",
  startingPrice: "100.00",
  buyNowPrice: null,
  currentPrice: "1101.00",
  buyerPremiumRate: "0.25",
  minBidIncrement: "25.00",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 60_000,
  dutchLastDecrementAt: null,
  startTime: new Date("2026-04-01T10:00:00.000Z"),
  endTime: new Date("2026-04-10T18:00:00.000Z"),
  status: "active",
  winnerId: null,
  createdAt: new Date("2026-03-01T10:00:00.000Z"),
  updatedAt: new Date("2026-03-15T10:00:00.000Z"),
  marketingDetails: {},
  hasReserve: true,
  reserveMet: false,
};

describe("LotDetailsInline", () => {
  it("never renders a numeric reserve amount", () => {
    render(
      <LotDetailsInline
        lot={publicLot}
        minNextBid="1126.00"
        saleEndLocalLabel="10 Apr 2026, 19:00"
        currentPrice="1101.00"
        hasReserve
      />,
    );

    expect(screen.getByText(/Reserve:/)).toBeInTheDocument();
    expect(screen.getByText(/amount not disclosed/i)).toBeInTheDocument();
    expect(screen.queryByText(/27,000|27000/)).not.toBeInTheDocument();
  });

  it("shows no reserve when lot has none", () => {
    render(
      <LotDetailsInline
        lot={{ ...publicLot, hasReserve: false, reserveMet: null }}
        minNextBid="125.00"
        saleEndLocalLabel="10 Apr 2026, 19:00"
        currentPrice="1101.00"
        hasReserve={false}
      />,
    );

    expect(screen.getByText(/Reserve: No reserve/)).toBeInTheDocument();
  });
});
