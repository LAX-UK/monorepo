import {
  parseResultsPage,
  parseResultsView,
  resultsHref,
} from "@/lib/marketing/results-page-params";
import { describe, expect, it } from "vitest";

describe("parseResultsView", () => {
  it("opens the sales list by default", () => {
    expect(parseResultsView({})).toBe("sales");
    expect(parseResultsView({ view: "grid" })).toBe("sales");
  });

  it("opens the lots search for view=lots", () => {
    expect(parseResultsView({ view: "lots" })).toBe("lots");
    expect(parseResultsView({ view: ["lots", "sales"] })).toBe("lots");
  });
});

describe("parseResultsPage", () => {
  it("defaults to page one and ignores bad values", () => {
    expect(parseResultsPage({})).toBe(1);
    expect(parseResultsPage({ page: "0" })).toBe(1);
    expect(parseResultsPage({ page: "abc" })).toBe(1);
    expect(parseResultsPage({ page: "3" })).toBe(3);
  });
});

describe("resultsHref", () => {
  it("keeps the canonical URL short", () => {
    expect(resultsHref("sales")).toBe("/results");
    expect(resultsHref("sales", 2)).toBe("/results?page=2");
    expect(resultsHref("lots")).toBe("/results?view=lots");
  });
});
