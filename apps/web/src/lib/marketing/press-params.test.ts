import { describe, expect, it } from "vitest";
import {
  buildPressActiveFilterChips,
  buildPressHubClampedPageQuery,
  buildPressHubQuery,
  parsePressHubParams,
  pressHubHasNonCanonicalState,
  pressHubOffset,
  pressHubPageOutOfRange,
  pressHubTotalPages,
} from "./press-params.js";

describe("press-params", () => {
  it("parses q, year, and page from search params", () => {
    expect(parsePressHubParams({ q: "Daily Mail", year: "2026", page: "2" })).toEqual({
      q: "Daily Mail",
      year: 2026,
      page: 2,
    });
  });

  it("builds query string round-trip", () => {
    const params = { q: "Evening", year: 2026, page: 1 };
    expect(buildPressHubQuery(params)).toBe("?q=Evening&year=2026");
    expect(
      parsePressHubParams(Object.fromEntries(new URLSearchParams(buildPressHubQuery(params)))),
    ).toEqual(params);
  });

  it("builds active filter chips with remove hrefs resetting page", () => {
    expect(buildPressActiveFilterChips({ q: "BBC", year: 2024, page: 3 })).toEqual([
      { key: "q", label: "Search: “BBC”", removeHref: "?year=2024" },
      { key: "year", label: "2024", removeHref: "?q=BBC" },
    ]);
  });

  it("detects non-canonical hub URL state", () => {
    expect(pressHubHasNonCanonicalState({ q: "", year: null, page: 1 })).toBe(false);
    expect(pressHubHasNonCanonicalState({ q: "BBC", year: null, page: 1 })).toBe(true);
    expect(pressHubHasNonCanonicalState({ q: "", year: 2024, page: 1 })).toBe(true);
    expect(pressHubHasNonCanonicalState({ q: "", year: null, page: 2 })).toBe(true);
  });

  it("computes offset from page", () => {
    expect(pressHubOffset({ q: "", year: null, page: 3 })).toBe(48);
  });

  it("detects out-of-range pages and builds clamped query", () => {
    const params = { q: "BBC", year: 2024, page: 99 };
    expect(pressHubTotalPages(50)).toBe(3);
    expect(pressHubPageOutOfRange(params, 50)).toBe(true);
    expect(pressHubPageOutOfRange({ q: "", year: null, page: 1 }, 50)).toBe(false);
    expect(buildPressHubClampedPageQuery(params, 50)).toBe("?q=BBC&year=2024&page=3");
  });
});
