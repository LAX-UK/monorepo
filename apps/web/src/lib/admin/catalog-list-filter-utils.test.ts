import { describe, expect, it } from "vitest";
import { countActiveCatalogFilters } from "./catalog-list-filter-utils";

describe("countActiveCatalogFilters", () => {
  it("counts non-empty string values", () => {
    expect(countActiveCatalogFilters(["", null, "q", undefined, "sort"])).toBe(2);
  });
});
