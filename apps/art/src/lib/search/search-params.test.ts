import { describe, expect, it } from "vitest";
import {
  countActiveSearchFilters,
  parseSearchParams,
  parseSearchQuery,
  searchClearFiltersHref,
  searchFilterHref,
  searchHref,
} from "./search-params.js";

describe("search params", () => {
  it("caps the query length and takes the first value", () => {
    expect(parseSearchQuery("a".repeat(200))).toHaveLength(120);
    expect(parseSearchQuery(["first", "second"])).toBe("first");
  });

  it("defaults to the Available tab sorted by newest and ignores unknown values", () => {
    expect(parseSearchParams({ q: "coin", tab: "lots", sort: "relevance" })).toEqual({
      q: "coin",
      tab: "available",
      sort: "newest",
    });
  });

  it("parses filters, swaps inverted prices and keeps availability on Available only", () => {
    expect(
      parseSearchParams({
        q: "coin",
        availability: "for_sale",
        objectType: "print",
        minPrice: "900",
        maxPrice: "100",
        cursor: "c1",
      }),
    ).toEqual({
      q: "coin",
      tab: "available",
      sort: "newest",
      availability: "for_sale",
      objectType: "print",
      minPrice: 100,
      maxPrice: 900,
      cursor: "c1",
    });
    expect(
      parseSearchParams({ q: "coin", tab: "sold", availability: "for_sale" }),
    ).not.toHaveProperty("availability");
    expect(parseSearchParams({ q: "coin", minPrice: "-5" })).not.toHaveProperty("minPrice");
  });

  it("round-trips state into a stable href", () => {
    const state = parseSearchParams({ q: "gold leaf", tab: "sold", sort: "priceAsc" });
    expect(searchHref(state)).toBe("/search?q=gold+leaf&tab=sold&sort=priceAsc");
    expect(searchHref({ q: "", tab: "available", sort: "newest" })).toBe("/search");
  });

  it("drops the cursor and availability when switching tab", () => {
    const state = parseSearchParams({ q: "coin", availability: "for_sale", cursor: "c1" });
    expect(searchFilterHref(state, { tab: "sold" })).toBe("/search?q=coin&tab=sold");
    expect(searchFilterHref(state, { sort: "titleAsc" })).toBe(
      "/search?q=coin&sort=titleAsc&availability=for_sale",
    );
  });

  it("counts and clears filters while keeping the tab and sort", () => {
    const state = parseSearchParams({
      q: "coin",
      tab: "sold",
      sort: "priceDesc",
      objectType: "print",
      maxPrice: "50",
    });
    expect(countActiveSearchFilters(state)).toBe(2);
    expect(searchClearFiltersHref(state)).toBe("/search?q=coin&tab=sold&sort=priceDesc");
  });
});
