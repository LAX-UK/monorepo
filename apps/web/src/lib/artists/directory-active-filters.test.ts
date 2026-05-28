import {
  type ArtistDirectoryFilterState,
  artistDirectoryClearFiltersHref,
  buildArtistDirectoryActiveFilterChips,
} from "@/lib/artists/directory-active-filters";
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

describe("buildArtistDirectoryActiveFilterChips", () => {
  it("returns chips for active query filters", () => {
    const chips = buildArtistDirectoryActiveFilterChips({
      ...baseState,
      q: "monet",
      hasUpcoming: true,
      sort: "popular",
    });

    expect(chips).toHaveLength(3);
    expect(chips[0]).toMatchObject({ key: "q", label: "Search: “monet”" });
    expect(chips[1]).toMatchObject({ key: "hasUpcoming", label: "Has upcoming lots" });
    expect(chips[2]).toMatchObject({ key: "sort", label: "Most lots" });
  });

  it("ignores path-locked nationality and decade query params", () => {
    const chips = buildArtistDirectoryActiveFilterChips({
      ...baseState,
      nationalityFromQuery: "French",
      nationalityIsLocked: true,
      decadeFromQuery: "1880s",
      decadeIsLocked: true,
    });

    expect(chips).toEqual([]);
  });

  it("includes removable nationality and decade from query", () => {
    const chips = buildArtistDirectoryActiveFilterChips({
      ...baseState,
      nationalityFromQuery: "French",
      decadeFromQuery: "1880s",
    });

    expect(chips).toHaveLength(2);
    expect(chips[0]).toMatchObject({ key: "nationality", label: "French" });
    expect(chips[1]).toMatchObject({ key: "decade", label: "Born 1880s" });
  });
});

describe("artistDirectoryClearFiltersHref", () => {
  it("returns canonical path preserving view", () => {
    expect(artistDirectoryClearFiltersHref("/artists/featured", "list")).toBe(
      "/artists/featured?view=list",
    );
  });
});
