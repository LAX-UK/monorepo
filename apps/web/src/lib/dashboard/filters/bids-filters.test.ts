import { describe, expect, it } from "vitest";
import {
  buildBidsHref,
  buildBidsTabHref,
  hasBidsActiveFilters,
  parseBidsParams,
} from "./bids/bids-filters";

describe("bids-filters", () => {
  it("parseBidsParams applies defaults", () => {
    expect(parseBidsParams({})).toEqual({ tab: "active", q: "" });
  });

  it("buildBidsTabHref preserves tab and q", () => {
    expect(buildBidsTabHref("won", "canvas")).toBe("/dashboard/bids?tab=won&q=canvas");
  });

  it("buildBidsHref clears search", () => {
    const current = parseBidsParams({ tab: "active", q: "oil" });
    expect(buildBidsHref(current, { q: null })).toBe("/dashboard/bids");
  });

  it("hasBidsActiveFilters detects q and non-default tab", () => {
    expect(hasBidsActiveFilters(parseBidsParams({ q: "lot" }))).toBe(true);
    expect(hasBidsActiveFilters(parseBidsParams({ tab: "won" }))).toBe(true);
    expect(hasBidsActiveFilters(parseBidsParams({}))).toBe(false);
  });
});
