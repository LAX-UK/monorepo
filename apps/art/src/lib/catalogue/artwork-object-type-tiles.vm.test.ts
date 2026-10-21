import { describe, expect, it } from "vitest";
import { parseArtworkCatalogueParams } from "./artwork-catalogue-params.js";
import { buildArtworkObjectTypeTiles } from "./artwork-object-type-tiles.vm.js";

const FACETS = [
  { objectType: "painting" as const, artworkCount: 12, coverImageUrl: "https://cdn.test/p.webp" },
  { objectType: "sculpture" as const, artworkCount: 1, coverImageUrl: null },
];

describe("buildArtworkObjectTypeTiles", () => {
  it("links each medium into the current filters and drops pagination", () => {
    const state = parseArtworkCatalogueParams({ type: "original", cursor: "c2" });
    const tiles = buildArtworkObjectTypeTiles(FACETS, state);

    expect(tiles).toEqual([
      {
        objectType: "painting",
        label: "Paintings",
        countLabel: "12 works",
        imageUrl: "https://cdn.test/p.webp",
        href: "/paintings?type=original",
        active: false,
      },
      {
        objectType: "sculpture",
        label: "Sculpture",
        countLabel: "1 work",
        imageUrl: null,
        href: "/sculptures?type=original",
        active: false,
      },
    ]);
  });

  it("marks the applied medium and lets its tile clear the filter", () => {
    const state = parseArtworkCatalogueParams({ objectType: "painting", q: "blue" });
    const [painting] = buildArtworkObjectTypeTiles(FACETS, state);

    expect(painting?.active).toBe(true);
    expect(painting?.href).toBe("/artworks?q=blue");
  });

  it("hides the strip when there is nothing to choose between", () => {
    const state = parseArtworkCatalogueParams({});
    expect(buildArtworkObjectTypeTiles(FACETS.slice(0, 1), state)).toEqual([]);
  });

  it("replaces a multi-medium selection with the tile's medium", () => {
    const state = parseArtworkCatalogueParams({ objectType: "painting,sculpture" });
    const [painting] = buildArtworkObjectTypeTiles(FACETS, state);

    expect(painting?.active).toBe(false);
    expect(painting?.href).toBe("/paintings");
  });
});
