import type { Lot } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArtworkBidPanel } from "./artwork-bid-panel";

vi.mock("@/hooks/use-lot-realtime", () => ({
  useLotRealtime: vi.fn(),
}));

vi.mock("@/lib/context/lot-ports", () => ({
  useLotPorts: () => ({
    bidWriter: {
      placeBid: vi.fn().mockResolvedValue({ ok: false, error: "fail", status: 400 }),
    },
  }),
}));

const lot = (sellerId: string): Lot => ({
  id: "lot-x",
  saleId: null,
  lotNumber: 1,
  sellerId,
  title: "Piece",
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
  dutchDecrementIntervalMs: 0,
  dutchLastDecrementAt: null,
  startTime: new Date(),
  endTime: new Date(Date.now() + 86_400_000),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("ArtworkBidPanel", () => {
  it("shows seller notice instead of bid form when user is the seller", () => {
    const sellerId = "user-seller-1";
    render(
      <ArtworkBidPanel
        auction={lot(sellerId)}
        initialHistory={[]}
        sessionUser={{
          id: sellerId,
          email: "a@b.co",
          name: "Seller",
          role: "user",
        }}
      />,
    );
    expect(screen.getByText(/this is your listing/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /review bid amount/i })).not.toBeInTheDocument();
  });

  it("shows bid form for a buyer", () => {
    render(
      <ArtworkBidPanel
        auction={lot("other-seller")}
        initialHistory={[]}
        sessionUser={{
          id: "buyer-1",
          email: "b@b.co",
          name: "Buyer",
          role: "user",
        }}
      />,
    );
    expect(screen.getByRole("button", { name: /review bid amount/i })).toBeInTheDocument();
  });
});
