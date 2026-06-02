import type { HomeUpcomingAuctionTileVM } from "@/components/sections/home/home-view-models";
import { LaxUpcomingAuctionsMarketing } from "@/components/sections/home/upcoming-auctions-marketing/lax-upcoming-auctions-marketing";
import { UpcomingAuctionsMarketingClient } from "@/components/sections/home/upcoming-auctions-marketing/upcoming-auctions-marketing-client";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/marketing/catalog-view-switcher", () => ({
  CatalogViewSwitcher: () => <span data-testid="view-switcher">View switcher</span>,
}));

vi.mock(
  "@/components/sections/home/upcoming-auctions-marketing/upcoming-auction-marketing-card",
  () => ({
    UpcomingAuctionMarketingCard: ({ tile }: { tile: { title: string } }) => (
      <div data-testid="auction-card">{tile.title}</div>
    ),
  }),
);

const minimalTile = (): HomeUpcomingAuctionTileVM => ({
  id: "sale-1",
  href: "/sales/test/1",
  title: "Modern Art Evening",
  dateLabel: "Jun 12",
  coverImageUrl: null,
  coverImageAlt: "",
  lotCount: 42,
  auctionKindLabel: "Online auction",
  deliveryMode: "online",
  status: "scheduled",
  locationLabel: "London",
});

describe("UpcomingAuctionsMarketingClient", () => {
  it("places View All in the section header, not the toolbar", () => {
    render(
      <UpcomingAuctionsMarketingClient
        tiles={[minimalTile()]}
        layoutView="grid"
        isAuthenticated={false}
      />,
    );

    const viewAllLinks = screen.getAllByRole("link", { name: /view all/i });
    expect(viewAllLinks).toHaveLength(1);
    expect(viewAllLinks[0]).toHaveAttribute("href", "/sales");
  });
});

describe("LaxUpcomingAuctionsMarketing", () => {
  it("omits the toolbar when there are no upcoming tiles", () => {
    render(<LaxUpcomingAuctionsMarketing tiles={[]} layoutView="grid" isAuthenticated={false} />);

    expect(screen.queryByText(/0 auctions/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("view-switcher")).not.toBeInTheDocument();
    expect(screen.getByText("No auctions scheduled")).toBeInTheDocument();
  });
});
