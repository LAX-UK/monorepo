import { LotAutoBidPanel } from "@/components/sections/artwork/redesign/lot-auto-bid-panel";
import type { Lot } from "@auction/types";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setAutoBidMock = vi.fn();
const clearAutoBidMock = vi.fn();

vi.mock("@/lib/context/lot-ports", () => ({
  useLotPorts: () => ({
    autoBidWriter: {
      setAutoBid: (...args: unknown[]) => setAutoBidMock(...args),
      clearAutoBid: (...args: unknown[]) => clearAutoBidMock(...args),
      getAutoBid: vi.fn(),
    },
  }),
}));

const lot: Lot = {
  id: "lot-1",
  saleId: null,
  lotNumber: 1,
  title: "Work",
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
  autoBidStepMax: "50",
  autoBidStepPresets: [10, 20, 50],
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 0,
  dutchLastDecrementAt: null,
  startTime: new Date(),
  endTime: new Date(Date.now() + 86_400_000),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: {},
};

describe("LotAutoBidPanel", () => {
  beforeEach(() => {
    setAutoBidMock.mockReset();
    clearAutoBidMock.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows selected step summary after chip click", () => {
    render(
      <LotAutoBidPanel
        lot={lot}
        auctionType="english"
        currentPrice="100"
        minNextBid={110}
        isWinning={false}
        disabled={false}
        loginNextPath="/lot/test/lot-1"
        initialSettings={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /\+£20\.00/i }));
    expect(screen.getByText(/raising by/i)).toBeInTheDocument();
    expect(screen.getAllByText(/£20\.00/i).length).toBeGreaterThan(0);
  });

  it("does not mark dirty when re-selecting the same step chip", () => {
    render(
      <LotAutoBidPanel
        lot={lot}
        auctionType="english"
        currentPrice="100"
        minNextBid={110}
        isWinning={false}
        disabled={false}
        loginNextPath="/lot/test/lot-1"
        initialSettings={null}
      />,
    );
    const chip = screen.getByRole("button", { name: /\+£10\.00/i });
    fireEvent.click(chip);
    expect(screen.queryByText(/save auto-bid to apply/i)).not.toBeInTheDocument();
  });

  it("confirms before clearing a saved auto-bid", async () => {
    clearAutoBidMock.mockResolvedValueOnce({ ok: true });
    render(
      <LotAutoBidPanel
        lot={lot}
        auctionType="english"
        currentPrice="100"
        minNextBid={110}
        isWinning={false}
        disabled={false}
        loginNextPath="/lot/test/lot-1"
        initialSettings={{
          maxAutoBidAmount: "500",
          autoBidStepAmount: "10",
          isActive: true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /clear auto-bid/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/removes your saved max auto-bid/i)).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /^clear auto-bid$/i }),
    );
    await waitFor(() => expect(clearAutoBidMock).toHaveBeenCalledWith("lot-1"));
  });
});
