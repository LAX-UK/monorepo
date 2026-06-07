import { describe, expect, it } from "vitest";
import {
  buildInSaleHref,
  countInSaleSheetFilters,
  hasInSaleActiveFilters,
  parseInSaleParams,
} from "./in-sale/in-sale-filters";

describe("in-sale-filters", () => {
  it("parseInSaleParams applies defaults", () => {
    expect(parseInSaleParams({})).toEqual({ status: "live", q: "" });
  });

  it("buildInSaleHref clears search", () => {
    const current = parseInSaleParams({ status: "ended", q: "landscape" });
    expect(buildInSaleHref(current, { q: null })).toBe("/dashboard/seller/in-sale?status=ended");
  });

  it("hasInSaleActiveFilters detects status and q", () => {
    expect(hasInSaleActiveFilters(parseInSaleParams({ q: "lot" }))).toBe(true);
    expect(hasInSaleActiveFilters(parseInSaleParams({ status: "all" }))).toBe(true);
    expect(hasInSaleActiveFilters(parseInSaleParams({}))).toBe(false);
  });

  it("countInSaleSheetFilters counts non-default status", () => {
    expect(countInSaleSheetFilters(parseInSaleParams({}))).toBe(0);
    expect(countInSaleSheetFilters(parseInSaleParams({ status: "ended" }))).toBe(1);
  });
});
