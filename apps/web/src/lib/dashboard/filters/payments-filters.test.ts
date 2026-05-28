import { describe, expect, it } from "vitest";
import {
  buildPaymentsHref,
  countPaymentsMobileSheetFilters,
  hasPaymentsActiveFilters,
  parsePaymentsParams,
} from "./payments/payments-filters";

describe("payments-filters", () => {
  it("parsePaymentsParams applies defaults", () => {
    expect(parsePaymentsParams({})).toEqual({
      status: "all",
      q: "",
      sort: "date-desc",
      year: null,
    });
  });

  it("buildPaymentsHref toggles status and year", () => {
    const current = parsePaymentsParams({ status: "pending", year: "2024" });
    expect(buildPaymentsHref(current, { status: "all" })).toBe("/dashboard/payments?year=2024");
  });

  it("hasPaymentsActiveFilters detects dimensions", () => {
    expect(hasPaymentsActiveFilters(parsePaymentsParams({ q: "lot" }))).toBe(true);
    expect(hasPaymentsActiveFilters(parsePaymentsParams({ status: "pending" }))).toBe(true);
    expect(hasPaymentsActiveFilters(parsePaymentsParams({ sort: "amount-asc" }))).toBe(true);
    expect(hasPaymentsActiveFilters(parsePaymentsParams({ year: "2023" }))).toBe(true);
    expect(hasPaymentsActiveFilters(parsePaymentsParams({}))).toBe(false);
  });

  it("countPaymentsMobileSheetFilters counts status year sort", () => {
    expect(countPaymentsMobileSheetFilters(parsePaymentsParams({}))).toBe(0);
    expect(
      countPaymentsMobileSheetFilters(
        parsePaymentsParams({ status: "pending", year: "2024", sort: "amount-asc" }),
      ),
    ).toBe(3);
  });
});
