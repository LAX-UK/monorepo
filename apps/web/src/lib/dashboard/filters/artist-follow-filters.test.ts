import { describe, expect, it } from "vitest";
import { ARTIST_FOLLOW_FILTER_CONFIG } from "./artist-follow/artist-follow-filters";
import {
  buildArtistFollowHref,
  filterArtistFollowRows,
  hasArtistFollowActiveFilters,
  parseArtistFollowParams,
  sortArtistFollowRows,
} from "./artist-follow/artist-follow-filters";
import { getFilterParamKeys } from "./filter-config-utils";

describe("artist-follow-filters", () => {
  it("parseArtistFollowParams applies defaults", () => {
    expect(parseArtistFollowParams({})).toEqual({ q: "", sort: "addedDesc" });
  });

  it("buildArtistFollowHref clears search", () => {
    const current = parseArtistFollowParams({ q: "monet", sort: "nameAsc" });
    expect(buildArtistFollowHref(current, { q: null })).toBe(
      "/dashboard/watchlist?section=artists&sort=nameAsc",
    );
  });

  it("hasArtistFollowActiveFilters detects q and sort", () => {
    expect(hasArtistFollowActiveFilters(parseArtistFollowParams({ q: "picasso" }))).toBe(true);
    expect(hasArtistFollowActiveFilters(parseArtistFollowParams({ sort: "nameAsc" }))).toBe(true);
    expect(hasArtistFollowActiveFilters(parseArtistFollowParams({}))).toBe(false);
  });

  it("filterArtistFollowRows matches display names", () => {
    const rows = [
      { watchlistId: "1", artistId: "a", displayName: "Monet", createdAtMs: 1 },
      { watchlistId: "2", artistId: "b", displayName: "Picasso", createdAtMs: 2 },
    ];
    expect(filterArtistFollowRows(rows, "mon").map((r) => r.displayName)).toEqual(["Monet"]);
  });

  it("sortArtistFollowRows sorts by name and date", () => {
    const rows = [
      { watchlistId: "1", artistId: "a", displayName: "Zorn", createdAtMs: 1 },
      { watchlistId: "2", artistId: "b", displayName: "Abbott", createdAtMs: 2 },
    ];
    expect(sortArtistFollowRows(rows, "nameAsc").map((r) => r.displayName)).toEqual([
      "Abbott",
      "Zorn",
    ]);
    expect(sortArtistFollowRows(rows, "addedDesc").map((r) => r.displayName)).toEqual([
      "Abbott",
      "Zorn",
    ]);
  });
});

describe("filter-config-utils", () => {
  it("getFilterParamKeys reads config params", () => {
    expect(getFilterParamKeys(ARTIST_FOLLOW_FILTER_CONFIG)).toEqual(["q", "sort"]);
  });
});
