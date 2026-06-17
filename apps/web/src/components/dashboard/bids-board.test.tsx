import type { BidBoardRow } from "@/components/dashboard/bid-board-rows";
import { BidsBoard } from "@/components/dashboard/bids-board";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("q=nonexistent"),
  usePathname: () => "/dashboard/bids",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const sampleActive: BidBoardRow[] = [
  {
    bid: {
      id: "b1",
      amount: "1000",
      lotId: "l1",
      createdAt: new Date(),
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    } as BidBoardRow["bid"],
    lot: {
      id: "l1",
      title: "Blue Study",
      status: "active",
      currentPrice: "1000",
      images: [],
    } as unknown as BidBoardRow["lot"],
    statusLabel: "Winning",
    statusClassName: "text-primary",
    outbid: false,
    timeLeft: "1h 0m",
    placement: { onBehalf: false, channelLabel: null },
  },
];

describe("BidsBoard", () => {
  it("shows FilterEmptyState with clear filters when search matches nothing", () => {
    render(
      <BidsBoard
        loadFailure={null}
        active={sampleActive}
        won={[]}
        lost={[]}
        initialTab="active"
        initialQ="nonexistent"
        artistNameById={{}}
      />,
    );

    expect(screen.getByText(/No bids match this filter/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Clear filters/i })).toHaveAttribute(
      "href",
      "/dashboard/bids",
    );
  });
});
