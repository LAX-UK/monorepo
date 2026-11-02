import { describe, expect, it } from "vitest";
import { pastResultsSentence, searchAlertQuery, shouldOfferPastResults } from "./search-fallback";

const base = {
  q: "harbour",
  status: undefined,
  ending: undefined,
  offset: 0,
  onSaleCount: 0,
  loadFailed: false,
} as const;

describe("shouldOfferPastResults", () => {
  it("offers past results for a text search with nothing on sale", () => {
    expect(shouldOfferPastResults(base)).toBe(true);
  });
  it.each([
    ["no text", { q: "" }],
    ["a chosen status", { status: "ended" as const }],
    ["an ending window", { ending: "24h" }],
    ["a later page", { offset: 24 }],
    ["lots on sale", { onSaleCount: 2 }],
    ["a failed load", { loadFailed: true }],
  ])("does not offer them with %s", (_name, patch) => {
    expect(shouldOfferPastResults({ ...base, ...patch })).toBe(false);
  });
});

describe("pastResultsSentence", () => {
  it("says nothing for none", () => expect(pastResultsSentence(0)).toBe(""));
  it("is singular for one", () => expect(pastResultsSentence(1)).toBe("One past result matches."));
  it("spells small counts", () => expect(pastResultsSentence(3)).toBe("Three past results match."));
  it("uses digits from ten", () => expect(pastResultsSentence(12)).toBe("12 past results match."));
});

describe("searchAlertQuery", () => {
  it("keeps the text and the category only", () => {
    expect(searchAlertQuery("harbour")).toEqual({ q: "harbour" });
    expect(searchAlertQuery("harbour", "c1")).toEqual({ q: "harbour", categoryId: "c1" });
  });
});
