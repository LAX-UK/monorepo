import { describe, expect, it } from "vitest";
import {
  buildPortfolioHref,
  countPortfolioMobileSheetFilters,
  hasPortfolioActiveFilters,
  parsePortfolioParams,
} from "./portfolio/portfolio-filters";

describe("portfolio-filters", () => {
  it("parsePortfolioParams applies defaults", () => {
    expect(parsePortfolioParams({})).toEqual({
      q: "",
      payment: "all",
      year: null,
    });
  });

  it("buildPortfolioHref clears payment filter", () => {
    const current = parsePortfolioParams({ payment: "paid", q: "monet" });
    expect(buildPortfolioHref(current, { payment: "all" })).toBe("/dashboard/portfolio?q=monet");
  });

  it("hasPortfolioActiveFilters detects q payment year", () => {
    expect(hasPortfolioActiveFilters(parsePortfolioParams({ q: "blue" }))).toBe(true);
    expect(hasPortfolioActiveFilters(parsePortfolioParams({ payment: "due" }))).toBe(true);
    expect(hasPortfolioActiveFilters(parsePortfolioParams({ year: "2022" }))).toBe(true);
    expect(hasPortfolioActiveFilters(parsePortfolioParams({}))).toBe(false);
  });

  it("countPortfolioMobileSheetFilters counts payment and year", () => {
    expect(countPortfolioMobileSheetFilters(parsePortfolioParams({ payment: "paid" }))).toBe(1);
    expect(
      countPortfolioMobileSheetFilters(parsePortfolioParams({ payment: "paid", year: "2020" })),
    ).toBe(2);
  });
});
