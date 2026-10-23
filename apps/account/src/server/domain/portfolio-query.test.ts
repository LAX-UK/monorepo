import { describe, expect, it } from "vitest";
import { hasActiveFilter, parseHoldingsQuery, parseMoneyQuery } from "./portfolio-query";

describe("parseHoldingsQuery", () => {
  it("reads every holdings filter from the URL", () => {
    expect(
      parseHoldingsQuery({
        status: "owned",
        product: "bid",
        artist: " Ada Artist ",
        year: "2026",
        currency: "GBP",
      }),
    ).toEqual({
      statuses: ["owned"],
      products: ["bid"],
      artist: "Ada Artist",
      year: 2026,
      currency: "GBP",
    });
  });

  it("ignores unknown, empty and malformed values instead of failing", () => {
    expect(
      parseHoldingsQuery({
        status: "lost",
        product: "stock",
        artist: "  ",
        year: "20x6",
        currency: "gbp",
      }),
    ).toEqual({});
  });

  it("uses the first of a repeated parameter", () => {
    expect(parseHoldingsQuery({ status: ["sold", "owned"] })).toEqual({ statuses: ["sold"] });
  });
});

describe("parseHoldingsQuery search", () => {
  it("reads the search text, trimmed and capped", () => {
    expect(parseHoldingsQuery({ q: "  blue " })).toEqual({ search: "blue" });
    expect(parseHoldingsQuery({ q: "x".repeat(300) }).search).toHaveLength(100);
    expect(parseHoldingsQuery({ q: "  " })).toEqual({});
  });
});

describe("parseMoneyQuery", () => {
  it("reads business, section and currency", () => {
    expect(parseMoneyQuery({ business: "lax_art", section: "received", currency: "EUR" })).toEqual({
      business: "lax_art",
      section: "received",
      currency: "EUR",
    });
  });

  it("ignores values outside the contract", () => {
    expect(
      parseMoneyQuery({ business: "lax_stock", section: "netted", currency: "pounds" }),
    ).toEqual({});
  });
});

describe("hasActiveFilter", () => {
  it("is true only when a filter is set", () => {
    expect(hasActiveFilter({})).toBe(false);
    expect(hasActiveFilter({ currency: "GBP" })).toBe(true);
  });
});
