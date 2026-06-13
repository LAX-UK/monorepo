import {
  CatalogLotCardView,
  CatalogLotGridView,
  CatalogLotListView,
} from "@/components/marketing/catalog-lot-views";
import { toCatalogLotVM } from "@/lib/lot/to-catalog-lot-vm";
import type { Lot } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/marketing/watchlist-heart-button", () => ({
  MarketingWatchlistHeart: ({
    lotId,
    initialWatching,
    loginNextPath,
    layout,
  }: {
    lotId: string;
    initialWatching: boolean;
    loginNextPath: string;
    layout?: string;
  }) => (
    <button
      type="button"
      data-testid={`watchlist-${lotId}`}
      data-watching={initialWatching ? "true" : "false"}
      data-login-next={loginNextPath}
      data-layout={layout ?? "overlay"}
    >
      Watchlist
    </button>
  ),
}));

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: () => <div data-testid="media-image" />,
}));

vi.mock("@/components/marketing/lot-status-badge", () => ({
  LotStatusBadge: () => <span data-testid="lot-status-badge" />,
  LotStatusTimer: () => <span data-testid="lot-status-timer" />,
}));

const viewProps = {
  currentUserId: "user-1",
  isAuthenticated: true,
  watchedLotIds: ["lot-2"],
  loginNextPath: "/search?q=test",
};

const minimalLot = (overrides: Partial<Lot> = {}): Lot => ({
  id: "lot-1",
  saleId: null,
  lotNumber: 1,
  title: "Test lot",
  description: null,
  medium: "Oil on canvas",
  dimensions: null,
  images: ["https://example.com/a.jpg"],
  categoryId: "c",
  auctionType: "english",
  startingPrice: "100",
  reservePrice: null,
  buyNowPrice: null,
  currentPrice: "200",
  buyerPremiumRate: "0.25",
  minBidIncrement: "10",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 0,
  dutchLastDecrementAt: null,
  startTime: new Date("2026-01-01"),
  endTime: new Date("2026-01-02"),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: {},
  ...overrides,
});

describe("CatalogLotGridView", () => {
  it("uses a 2-column grid on the default (mobile-first) breakpoint", () => {
    const { container } = render(
      <CatalogLotGridView
        lots={[toCatalogLotVM(minimalLot()), toCatalogLotVM(minimalLot({ id: "lot-2" }))]}
        {...viewProps}
      />,
    );
    const ul = container.querySelector("ul");
    expect(ul?.className).toMatch(/grid-cols-2/);
  });

  it("renders a watchlist heart per lot with initial state from watchedLotIds", () => {
    render(
      <CatalogLotGridView
        lots={[
          toCatalogLotVM(minimalLot()),
          toCatalogLotVM(minimalLot({ id: "lot-2", title: "Watched lot" })),
        ]}
        {...viewProps}
      />,
    );
    expect(screen.getByTestId("watchlist-lot-1")).toHaveAttribute("data-watching", "false");
    expect(screen.getByTestId("watchlist-lot-2")).toHaveAttribute("data-watching", "true");
    expect(screen.getByTestId("watchlist-lot-1")).toHaveAttribute(
      "data-login-next",
      "/search?q=test",
    );
  });
});

describe("CatalogLotCardView", () => {
  it("renders watchlist hearts on editorial cards", () => {
    render(<CatalogLotCardView lots={[toCatalogLotVM(minimalLot())]} {...viewProps} />);
    expect(screen.getByTestId("watchlist-lot-1")).toBeInTheDocument();
  });
});

describe("CatalogLotListView", () => {
  it("renders inline watchlist hearts in list rows", () => {
    render(<CatalogLotListView lots={[toCatalogLotVM(minimalLot())]} {...viewProps} />);
    const heart = screen.getByTestId("watchlist-lot-1");
    expect(heart).toHaveAttribute("data-layout", "inline");
  });
});
