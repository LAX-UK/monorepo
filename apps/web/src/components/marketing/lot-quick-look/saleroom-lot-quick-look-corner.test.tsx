import { SaleroomLotQuickLookCorner } from "@/components/marketing/lot-quick-look/saleroom-lot-quick-look-corner";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/marketing/watchlist-heart-button", () => ({
  MarketingWatchlistHeart: () => <button type="button">Watchlist</button>,
}));

vi.mock("@/components/marketing/lot-status-badge", () => ({
  LotStatusTimer: () => <span data-testid="lot-status-timer" />,
}));

vi.mock("./lot-quick-look-trigger", () => ({
  LotQuickLookTrigger: ({ overlaySlot }: { overlaySlot?: string }) => (
    <button type="button" data-testid="quick-look" data-overlay-slot={overlaySlot}>
      Quick look
    </button>
  ),
}));

const lot: SaleLotCardVM = {
  id: "lot-1",
  href: "/lot/test/1",
  lotLabel: "Lot 1",
  title: "Test lot",
  imageUrl: "https://example.com/lot.jpg",
  imageAlt: "Test",
  estimateValue: "£1,000",
  currentBidLabel: "Current bid",
  currentBidValue: "£500",
  bidsCountLabel: null,
  closingLabel: null,
  isLive: true,
  viewerOwnsLot: false,
  artistOrMedium: null,
  viewerIsWatching: false,
  status: "active",
  startTime: "2026-01-01T00:00:00.000Z",
  endTime: "2026-01-02T00:00:00.000Z",
  closingShort: null,
};

describe("SaleroomLotQuickLookCorner", () => {
  it("uses bottom-right quick look and does not render its own timer", () => {
    render(<SaleroomLotQuickLookCorner lot={lot} isAuthenticated={false} />);

    expect(screen.getByTestId("quick-look")).toHaveAttribute("data-overlay-slot", "bottomRight");
    expect(screen.queryByTestId("lot-status-timer")).not.toBeInTheDocument();
  });
});
