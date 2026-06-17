import type { BidBoardRow } from "@/components/dashboard/bid-board-rows";
import { BidsMobileList } from "@/components/dashboard/list/bids-mobile-list";
import type { Lot } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-now", () => ({
  useNow: () => Date.parse("2026-01-01T12:00:00.000Z"),
}));

vi.mock("@/lib/shell/shell-config-context", () => ({
  useShellConfig: () => ({ density: "normal" }),
}));

function activeLot(id: string, title: string): Lot {
  return {
    id,
    saleId: null,
    lotNumber: 1,
    title,
    description: null,
    medium: "Oil",
    dimensions: null,
    images: [],
    categoryId: "c",
    auctionType: "english",
    startingPrice: "100",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "500",
    buyerPremiumRate: "0.25",
    minBidIncrement: "50",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date("2026-01-01T00:00:00.000Z"),
    endTime: new Date("2026-01-02T00:00:00.000Z"),
    status: "active",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
  };
}

function bidRow(id: string, title: string): BidBoardRow {
  return {
    bid: {
      id: `bid-${id}`,
      lotId: id,
      amount: "500",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
      createdAt: new Date(),
    },
    lot: activeLot(id, title),
    statusLabel: "Winning",
    statusClassName: "text-primary",
    outbid: false,
    timeLeft: "12h",
    placement: { onBehalf: false, channelLabel: null },
  };
}

describe("BidsMobileList", () => {
  it("renders a live countdown on each active bid card", () => {
    render(
      <BidsMobileList
        rows={[bidRow("l1", "Blue Canvas Study"), bidRow("l2", "Red Landscape")]}
        artistNameById={{}}
        onOpenHistory={() => {}}
      />,
    );

    expect(screen.getAllByText("Live")).toHaveLength(2);
  });
});
