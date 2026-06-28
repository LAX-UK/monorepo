import { describe, expect, it } from "vitest";
import {
  buildPressActiveFilterChips,
  buildPressHubClampedPageQuery,
  buildPressHubQuery,
  formatPressApplyButtonLabel,
  formatPressArticleCount,
  getPressMentionTypeLabel,
  parsePressFilterMentionType,
  parsePressFilterYear,
  parsePressHubParams,
  pressFilterFormValuesToHubParams,
  pressHubHasNonCanonicalState,
  pressHubOffset,
  pressHubPageOutOfRange,
  pressHubParamsToFilterFormValues,
  pressHubTotalPages,
} from "./press-params.js";

describe("press-params", () => {
  it("parses q, year, mentionType, and page from search params", () => {
    expect(
      parsePressHubParams({ q: "Daily Mail", year: "2026", page: "2", mentionType: "feature" }),
    ).toEqual({
      q: "Daily Mail",
      year: 2026,
      mentionType: "feature",
      page: 2,
    });
  });

  it("builds query string round-trip", () => {
    const params = { q: "Evening", year: 2026, mentionType: null, page: 1 };
    expect(buildPressHubQuery(params)).toBe("?q=Evening&year=2026");
    expect(
      parsePressHubParams(Object.fromEntries(new URLSearchParams(buildPressHubQuery(params)))),
    ).toEqual(params);
  });

  it("builds active filter chips with remove hrefs resetting page", () => {
    expect(
      buildPressActiveFilterChips({ q: "BBC", year: 2024, mentionType: "interview", page: 3 }),
    ).toEqual([
      { key: "q", label: "Search: “BBC”", removeHref: "?year=2024&mentionType=interview" },
      { key: "year", label: "2024", removeHref: "?q=BBC&mentionType=interview" },
      { key: "mentionType", label: "Interview", removeHref: "?q=BBC&year=2024" },
    ]);
  });

  it("detects non-canonical hub URL state", () => {
    expect(pressHubHasNonCanonicalState({ q: "", year: null, mentionType: null, page: 1 })).toBe(
      false,
    );
    expect(pressHubHasNonCanonicalState({ q: "BBC", year: null, mentionType: null, page: 1 })).toBe(
      true,
    );
    expect(pressHubHasNonCanonicalState({ q: "", year: 2024, mentionType: null, page: 1 })).toBe(
      true,
    );
    expect(pressHubHasNonCanonicalState({ q: "", year: null, mentionType: "quote", page: 1 })).toBe(
      true,
    );
    expect(pressHubHasNonCanonicalState({ q: "", year: null, mentionType: null, page: 2 })).toBe(
      true,
    );
  });

  it("computes offset from page", () => {
    expect(pressHubOffset({ q: "", year: null, mentionType: null, page: 3 })).toBe(48);
  });

  it("detects out-of-range pages and builds clamped query", () => {
    const params = { q: "BBC", year: 2024, mentionType: null, page: 99 };
    expect(pressHubTotalPages(50)).toBe(3);
    expect(pressHubPageOutOfRange(params, 50)).toBe(true);
    expect(pressHubPageOutOfRange({ q: "", year: null, mentionType: null, page: 1 }, 50)).toBe(
      false,
    );
    expect(buildPressHubClampedPageQuery(params, 50)).toBe("?q=BBC&year=2024&page=3");
  });

  it("maps filter form values to hub params and back", () => {
    const params = { q: "BBC", year: 2025, mentionType: "interview" as const, page: 2 };
    const formValues = pressHubParamsToFilterFormValues(params);
    expect(formValues).toEqual({ q: "BBC", year: "2025", mentionType: "interview" });
    expect(pressFilterFormValuesToHubParams(formValues)).toEqual({
      q: "BBC",
      year: 2025,
      mentionType: "interview",
      page: 1,
    });
  });

  it("parses filter field helpers", () => {
    expect(parsePressFilterYear("2026")).toBe(2026);
    expect(parsePressFilterYear("")).toBeNull();
    expect(parsePressFilterMentionType("quote")).toBe("quote");
    expect(parsePressFilterMentionType("__all__")).toBeNull();
  });

  it("formats shared press count labels", () => {
    expect(formatPressArticleCount(1)).toBe("1 article");
    expect(formatPressArticleCount(12)).toBe("12 articles");
    expect(formatPressApplyButtonLabel(1)).toBe("Show 1 article");
    expect(formatPressApplyButtonLabel(12)).toBe("Show 12 articles");
    expect(getPressMentionTypeLabel("feature")).toBe("Feature");
  });
});
