import { ArtistDirectoryActiveFilters } from "@/components/sections/artists/artist-directory-active-filters";
import type { ArtistDirectoryFilterState } from "@/lib/artists/directory-active-filters";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const baseState: ArtistDirectoryFilterState = {
  canonicalPath: "/artists",
  searchParams: {},
  layoutView: "grid",
  nationalityIsLocked: false,
  decadeIsLocked: false,
  hasUpcoming: false,
  sort: "name_asc",
};

describe("ArtistDirectoryActiveFilters", () => {
  it("renders active chips when filters are set", () => {
    render(
      <ArtistDirectoryActiveFilters
        state={{
          ...baseState,
          q: "monet",
          sort: "popular",
        }}
      />,
    );

    expect(screen.getByLabelText("Active filters")).toBeInTheDocument();
    expect(screen.getByLabelText("Active filters")).toHaveTextContent("monet");
    expect(screen.getByLabelText("Active filters")).toHaveTextContent("Most lots");
  });

  it("renders nothing when no filters are active", () => {
    const { container } = render(<ArtistDirectoryActiveFilters state={baseState} />);
    expect(container).toBeEmptyDOMElement();
  });
});
