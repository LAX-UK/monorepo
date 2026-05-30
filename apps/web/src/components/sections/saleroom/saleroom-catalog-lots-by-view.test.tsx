import { SaleroomCatalogLotsByView } from "@/components/sections/saleroom/saleroom-catalog-lots-by-view";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

vi.mock("@/components/marketing/lot-status-badge", () => ({
  LotStatusBadge: () => <span data-testid="lot-status-badge" />,
  LotStatusTimer: () => <span data-testid="lot-status-timer" />,
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/marketing/watchlist-heart-button", () => ({
  MarketingWatchlistHeart: ({
    lotId,
    layout,
  }: {
    lotId: string;
    layout?: string;
  }) => (
    <button type="button" data-testid={`watchlist-${lotId}`} data-layout={layout ?? "overlay"}>
      Watchlist
    </button>
  ),
}));

vi.mock("@/components/marketing/lot-quick-look/lot-quick-look-trigger", () => ({
  LotQuickLookTrigger: () => <button type="button" data-testid="quick-look-trigger" />,
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
  artistOrMedium: "Artist Name",
  viewerIsWatching: false,
  status: "active",
  startTime: "2026-01-01T00:00:00.000Z",
  endTime: "2026-01-02T00:00:00.000Z",
  closingShort: null,
};

describe("SaleroomCatalogLotsByView", () => {
  it("renders cornerAction on grid when renderCorner is provided", () => {
    render(
      <SaleroomCatalogLotsByView
        view="grid"
        lots={[lot]}
        isAuthenticated={false}
        renderCorner={() => <span data-testid="corner-action">Heart</span>}
      />,
    );
    expect(screen.getByTestId("corner-action")).toBeInTheDocument();
  });

  it("renders inline watchlist in list rows when renderCorner is provided", () => {
    render(
      <SaleroomCatalogLotsByView
        view="list"
        lots={[lot]}
        isAuthenticated={true}
        renderCorner={() => <span data-testid="corner-action">Overlay</span>}
      />,
    );

    const heart = screen.getByTestId("watchlist-lot-1");
    expect(heart).toHaveAttribute("data-layout", "inline");
    expect(screen.getByTestId("quick-look-trigger")).toBeInTheDocument();
    expect(screen.queryByTestId("corner-action")).not.toBeInTheDocument();
  });
});
