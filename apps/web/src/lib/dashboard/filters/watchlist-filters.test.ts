import { describe, expect, it } from "vitest";
import {
  buildWatchlistHref,
  countWatchlistMobileSheetFilters,
  hasWatchlistActiveFilters,
  parseWatchlistParams,
} from "./watchlist/watchlist-filters";

describe("watchlist-filters", () => {
  it("parseWatchlistParams applies defaults", () => {
    expect(parseWatchlistParams({})).toEqual({
      sort: "addedDesc",
      categoryIds: [],
      q: "",
    });
  });

  it("buildWatchlistHref toggles status off", () => {
    const current = parseWatchlistParams({ status: "active", sort: "endingSoon" });
    expect(buildWatchlistHref(current, { status: null })).toBe(
      "/dashboard/watchlist?sort=endingSoon",
    );
  });

  it("hasWatchlistActiveFilters detects q and status", () => {
    expect(hasWatchlistActiveFilters(parseWatchlistParams({ q: "canvas" }))).toBe(true);
    expect(hasWatchlistActiveFilters(parseWatchlistParams({ status: "active" }))).toBe(true);
    expect(hasWatchlistActiveFilters(parseWatchlistParams({}))).toBe(false);
  });

  it("countWatchlistMobileSheetFilters includes status categories and sort", () => {
    expect(countWatchlistMobileSheetFilters(parseWatchlistParams({}))).toBe(0);
    expect(
      countWatchlistMobileSheetFilters(
        parseWatchlistParams({ status: "active", sort: "priceAsc", categoryIds: "a,b" }),
      ),
    ).toBe(3);
  });
});
