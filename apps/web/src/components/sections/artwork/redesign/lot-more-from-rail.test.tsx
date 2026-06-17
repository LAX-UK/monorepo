import type {
  LotRailCardVM,
  LotRelatedRailVM,
} from "@/components/sections/artwork/artwork-view-models";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LotMoreFromRail } from "./lot-more-from-rail";

vi.mock("@/lib/time/use-client-clock", () => ({
  useClientClock: () => Date.parse("2026-01-01T12:00:00.000Z"),
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
      artistOrSellerName: "Artist One",
      estimateLine: "$1,000 – $2,000",
      currentPrice: "900.00",
      endTime: "2026-06-01T18:00:00.000Z",
      status: "active",
      sellerId: "seller-1",
    },
  ],
};

describe("LotMoreFromRail", () => {
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
});
