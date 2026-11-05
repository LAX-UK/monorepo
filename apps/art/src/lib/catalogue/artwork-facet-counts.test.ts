import { describe, expect, it } from "vitest";
import { buildArtworkFacetCountsVm, withFacetCounts } from "./artwork-facet-counts";

describe("buildArtworkFacetCountsVm", () => {
  it("keys each group's counts by option", () => {
    const vm = buildArtworkFacetCountsVm({
      availability: { available: 0, soldOut: 0 },
      categories: [{ slug: "oil", label: "Oil", count: 2 }],
      artists: [{ slug: "ada", name: "Ada", count: 5 }],
      objectTypes: [{ key: "painting", count: 4 }],
    });
    expect(vm).toEqual({
      artists: { ada: 5 },
      categories: { oil: 2 },
      objectTypes: { painting: 4 },
      saleStates: null,
    });
  });
});

describe("withFacetCounts", () => {
  const options = [
    { value: "", label: "Any" },
    { value: "a", label: "A" },
    { value: "b", label: "B" },
  ];

  it("counts an option the counts leave out as zero, and leaves Any uncounted", () => {
    expect(withFacetCounts(options, { a: 3 })).toEqual([
      { value: "", label: "Any" },
      { value: "a", label: "A", count: 3 },
      { value: "b", label: "B", count: 0 },
    ]);
  });

  it("leaves every option as it is when there are no counts", () => {
    expect(withFacetCounts(options, null)).toEqual(options);
  });
});
