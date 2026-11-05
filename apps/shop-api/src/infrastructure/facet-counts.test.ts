import { describe, expect, it } from "vitest";
import { FACET_SALE_STATES, orderedCounts } from "./facet-counts.js";

describe("orderedCounts", () => {
  it("lists the keys in the given order, not the order the rows came back in", () => {
    const rows = [
      { key: "sold", count: "2" },
      { key: "for_sale", count: 5 },
    ];
    expect(orderedCounts(FACET_SALE_STATES, rows)).toEqual([
      { key: "for_sale", count: 5 },
      { key: "sold", count: 2 },
    ]);
  });

  it("leaves out keys with no works and keys it does not list", () => {
    const rows = [
      { key: "price_on_application", count: 0 },
      { key: "withdrawn", count: 3 },
      { key: null, count: 1 },
    ];
    expect(orderedCounts(FACET_SALE_STATES, rows)).toEqual([]);
  });
});
