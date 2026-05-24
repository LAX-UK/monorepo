import { ArtistFiltersSheet } from "@/components/sections/artists/artist-filters-sheet";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/use-is-md", () => ({
  useIsMd: () => false,
}));

const filterGroups = [
  {
    id: "scenario",
    title: "Scenario",
    links: [
      {
        label: "All",
        href: "/artists",
        count: 10,
        active: true,
      },
      {
        label: "Featured",
        href: "/artists/featured",
        count: 2,
        active: false,
      },
    ],
  },
  {
    id: "kind",
    title: "Kind",
    links: [
      {
        label: "Artists",
        href: "/artists/kind/artists",
        count: 8,
        active: false,
      },
    ],
  },
];

describe("ArtistFiltersSheet", () => {
  it("opens sheet with filter groups and sort controls", () => {
    render(
      <ArtistFiltersSheet
        activeCount={1}
        canonicalPath="/artists"
        sort="popular"
        groups={filterGroups}
        nationalityLinks={[
          { label: "Any", href: "/artists", active: true },
          { label: "British", href: "/artists/nationality/british", count: 5, active: false },
        ]}
        clearHref="/artists"
        hasFilters={false}
        resultCountLabel="Show 10 artists"
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Filters/i })[0]!);

    expect(screen.getByRole("heading", { name: "Scenario" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kind" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Top nationalities" })).toBeInTheDocument();
    expect(screen.getByText("Sort by")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 10 artists" })).toBeInTheDocument();
  });
});
