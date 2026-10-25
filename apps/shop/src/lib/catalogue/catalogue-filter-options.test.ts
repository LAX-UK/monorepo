import { describe, expect, it } from "vitest";
import { buildCatalogueFilterOptions } from "./catalogue-filter-options";

describe("buildCatalogueFilterOptions", () => {
  const listed = [
    { slug: "prints", label: "Prints" },
    { slug: "empty", label: "Empty category" },
  ];

  it("uses the counted options, so options without works drop out", () => {
    expect(
      buildCatalogueFilterOptions(listed, [{ slug: "prints", label: "Prints", count: 4 }]),
    ).toEqual([{ slug: "prints", label: "Prints", count: 4 }]);
  });

  it("falls back to every listed option, uncounted, when counts are unavailable", () => {
    expect(buildCatalogueFilterOptions(listed, undefined)).toEqual(listed);
  });
});
