import { SearchNoMatches } from "@/components/marketing/search-fallback";
import type { SearchFallback } from "@/lib/marketing/load-search-fallback";
import type { Sale } from "@auction/types";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/marketing/catalog-lot-view-client", () => ({
  CatalogLotViewClient: () => <div data-testid="past-lots" />,
}));
vi.mock("@/components/marketing/search-alert-button", () => ({
  SearchAlertButton: () => <button type="button">Alert me</button>,
}));
vi.mock("@/components/sections/artists/catalog-artist-views", () => ({
  ArtistBrowseGrid: () => <div data-testid="artists" />,
}));
vi.mock("@/components/sections/sales/featured-auctions-grid", () => ({
  FeaturedAuctionsGrid: ({ vms }: { vms: { id: string; title: string }[] }) => (
    <ul>
      {vms.map((vm) => (
        <li key={vm.id}>{vm.title}</li>
      ))}
    </ul>
  ),
}));

const when = new Date("2026-11-12T04:49:00Z");
const sale = {
  id: "s1",
  title: "Winter evening sale",
  description: null,
  coverImages: [],
  deliveryMode: "online",
  status: "scheduled",
  startTime: when,
  endTime: when,
  createdAt: when,
  updatedAt: when,
} as unknown as Sale;

const none: SearchFallback = { pastLots: [], pastCount: 0, artists: [], sales: [] };

function draw(fallback: SearchFallback) {
  return render(
    <SearchNoMatches
      q="winter"
      fallback={fallback}
      layoutView="grid"
      isAuthenticated={false}
      currentUserId={null}
      watchedLotIds={[]}
      treatments={{} as never}
      watchedArtistIds={new Set()}
      clearHref="/search"
      pastResultsHref="/search?status=ended"
      alertReturnHref="/search?q=winter&alert=1"
      saveAlertOnArrival={false}
      alertSet={false}
    />,
  );
}

describe("SearchNoMatches", () => {
  it("shows the sales whose names match, in their own group", () => {
    draw({ ...none, sales: [{ sale, lots: [], lotCount: 3 }] });
    const group = screen.getByRole("region", { name: "Sales" });
    expect(within(group).getByText("Winter evening sale")).toBeInTheDocument();
  });

  it("leaves the group out when no sale matches, keeping the empty state", () => {
    draw(none);
    expect(screen.queryByRole("region", { name: "Sales" })).toBeNull();
    expect(screen.getByRole("heading", { name: /No lots on sale match/ })).toBeInTheDocument();
  });
});
