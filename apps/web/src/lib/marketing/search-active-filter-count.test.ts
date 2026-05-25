import { countSearchActiveFilters } from "@/lib/marketing/search-active-filter-count";
import { describe, expect, it } from "vitest";

describe("countSearchActiveFilters", () => {
  it("returns 0 when all defaults", () => {
    expect(countSearchActiveFilters({ sort: "endingAsc" })).toBe(0);
  });

  it("counts q, category, and non-default sort", () => {
    expect(
      countSearchActiveFilters({
        q: "monet",
        categoryId: "cat-1",
        sort: "hammerDesc",
      }),
    ).toBe(3);
  });

  it("counts status and ending window filters", () => {
    expect(
      countSearchActiveFilters({
        sort: "endingAsc",
        status: "active",
        ending: "24h",
      }),
    ).toBe(2);
  });
});
