import type {
  LotRailCardVM,
  LotRelatedRailVM,
} from "@/components/sections/artwork/artwork-view-models";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LotMoreFromRail } from "./lot-more-from-rail";

vi.mock("@/lib/time/use-clock", () => ({
  useClockNow: () => Date.parse("2026-01-01T12:00:00.000Z"),
  useCountdownTick: () => Date.parse("2026-01-01T12:00:00.000Z"),
  useCountdown: () => null,
}));

vi.mock("@/components/marketing/lot-quick-look/lot-quick-look-trigger", () => ({
  LotQuickLookTrigger: () => <button type="button">Quick look</button>,
}));

vi.mock("@/components/marketing/owner-badge", () => ({
  OwnerBadge: ({ owned }: { owned: boolean }) =>
    owned ? <span data-testid="owner-badge">Your listing</span> : null,
}));

vi.mock("@/components/marketing/watchlist-heart-button", () => ({
  MarketingWatchlistHeart: ({
    lotId,
    initialWatching,
    isAuthenticated,
    layout,
    loginNextPath,
  }: {
    lotId: string;
    initialWatching: boolean;
    isAuthenticated: boolean;
    layout?: string;
    loginNextPath: string;
  }) => (
    <button
      type="button"
      data-testid={`watchlist-${lotId}`}
      data-watching={initialWatching ? "true" : "false"}
      data-authenticated={isAuthenticated ? "true" : "false"}
      data-layout={layout ?? "overlay"}
      data-login-next={loginNextPath}
    >
      Watchlist
    </button>
  ),
}));

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: () => <div data-testid="media-image" />,
}));

const rail: LotRelatedRailVM = {
  mode: "sale",
  heading: "More from this sale",
  viewAuctionHref: "/sales/test",
  cards: [
    {
      id: "lot-a",
      href: "/lot/test/lot-a",
      imageUrl: "https://example.com/a.jpg",
      lotNumber: 2,
      title: "Related Lot A",
      artistName: "Artist One",
      estimateLine: "$1,000 – $2,000",
      saleId: "sale-1",
      sellerId: "seller-1",
    },
  ],
  premiumSale: null,
};

const liveFields = {
  currentBidLabel: "Current bid",
  currentBidValue: "$900",
  endTime: "2026-06-01T18:00:00.000Z",
  status: "active",
};

const liveRead = vi.fn();
vi.mock("@/lib/marketing/artwork/lot-rail-live.client", () => ({
  useLotRailLive: () => liveRead(),
}));

describe("LotMoreFromRail", () => {
  beforeEach(() => liveRead.mockReturnValue(new Map([["lot-a", liveFields]])));

  it("renders watchlist heart on compact cards", () => {
    render(
      <LotMoreFromRail rail={rail} isAuthenticated watchedLotIds={["lot-a"]} density="compact" />,
    );

    const heart = screen.getByTestId("watchlist-lot-a");
    expect(heart).toBeInTheDocument();
    expect(heart).toHaveAttribute("data-layout", "inline");
    expect(heart).toHaveAttribute("data-watching", "true");
    expect(heart).toHaveAttribute("data-authenticated", "true");
    expect(heart).toHaveAttribute("data-login-next", "/lot/test/lot-a");
  });

  it("does not render watchlist heart overlay on rich cards", () => {
    render(
      <LotMoreFromRail rail={rail} isAuthenticated watchedLotIds={["lot-a"]} density="rich" />,
    );

    expect(screen.queryByTestId("watchlist-lot-a")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^bid$/i })).toBeInTheDocument();
  });

  it("does not render Bid button on rich cards for onsite delivery mode", () => {
    const railOnsite: LotRelatedRailVM = {
      ...rail,
      cards: [
        {
          ...rail.cards[0],
          deliveryMode: "onsite",
          allowOnlineBidsBeforeGoLive: false,
        } as LotRailCardVM,
      ],
    };
    render(
      <LotMoreFromRail
        rail={railOnsite}
        isAuthenticated
        watchedLotIds={["lot-a"]}
        density="rich"
      />,
    );

    expect(screen.queryByRole("link", { name: /^bid$/i })).not.toBeInTheDocument();
  });

  it.each(["rich", "compact"] as const)(
    "draws placeholders, not a price, before the live read lands (%s)",
    (density) => {
      liveRead.mockReturnValue(null);
      render(<LotMoreFromRail rail={rail} isAuthenticated watchedLotIds={[]} density={density} />);

      expect(screen.getByTestId("rail-price-pending")).toBeInTheDocument();
      expect(screen.queryByText("$900")).not.toBeInTheDocument();
      expect(screen.queryByText("Current bid")).not.toBeInTheDocument();
      // The estimate and the title are the page's own.
      expect(screen.getByText("Related Lot A")).toBeInTheDocument();
    },
  );

  it.each(["rich", "compact"] as const)(
    "shows the live price once the read lands (%s)",
    (density) => {
      render(<LotMoreFromRail rail={rail} isAuthenticated watchedLotIds={[]} density={density} />);

      expect(screen.queryByTestId("rail-price-pending")).not.toBeInTheDocument();
      expect(screen.getByText("$900")).toBeInTheDocument();
      if (density === "rich") expect(screen.getByText("Current bid")).toBeInTheDocument();
    },
  );
});
