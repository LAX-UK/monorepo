import { SIGNED_IN_VIEWER, artworkSummary, fakeArtServices } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import { composeArtworksPage, composeArtworksPageMetadata } from "./artworks-page.composer.js";

describe("composeArtworksPage", () => {
  it("passes URL filters to the catalogue in pence and builds the pager", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks.mockResolvedValue({
      items: [artworkSummary()],
      nextCursor: "c2",
      totalCount: 30,
    });
    services.catalogue.listCategories.mockResolvedValue({
      items: [{ slug: "painting", label: "Painting" }],
    });

    const vm = await composeArtworksPage(services, {
      type: "original",
      minPrice: "100",
      sort: "priceAsc",
    });

    expect(services.catalogue.listArtworks).toHaveBeenCalledWith({
      limit: 24,
      type: "original",
      minPrice: 10000,
      sort: "priceAsc",
    });
    expect(vm.resultCount).toBe(30);
    expect(vm.hasActiveFilters).toBe(true);
    expect(vm.categories).toEqual([{ slug: "painting", label: "Painting" }]);
    expect(vm.nextPageHref).toBe("/artworks?type=original&minPrice=100&sort=priceAsc&cursor=c2");
    expect(vm.favoriteAuth.loginHref).toBe(
      "/login?returnTo=%2Fartworks%3Ftype%3Doriginal%26minPrice%3D100%26sort%3DpriceAsc",
    );
  });

  it("reports a failed catalogue without dropping filter lookups", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.catalogue.listArtworks.mockRejectedValue(new Error("down"));
    services.catalogue.listArtists.mockResolvedValue({
      items: [{ slug: "a", name: "A", discipline: null, portraitUrl: null, artworkCount: 1 }],
    });

    const vm = await composeArtworksPage(services, {});

    expect(vm.failed).toBe(true);
    expect(vm.cards).toEqual([]);
    expect(vm.artists).toEqual([{ slug: "a", label: "A" }]);
    expect(vm.nextPageHref).toBeNull();
  });

  it("builds medium tiles and medium options from facets, degrading when facets fail", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworkObjectTypes.mockResolvedValue({
      items: [
        { objectType: "painting", artworkCount: 2, coverImageUrl: null },
        { objectType: "print", artworkCount: 5, coverImageUrl: null },
      ],
    });
    const vm = await composeArtworksPage(services, { type: "edition" });
    expect(vm.objectTypeTiles.map((tile) => [tile.label, tile.active])).toEqual([
      ["Paintings", false],
      ["Prints", false],
    ]);
    expect(vm.mediumOptions.map((option) => option.value)).toEqual(["painting", "print"]);
    expect(vm.landingHero).toBeNull();

    services.catalogue.listArtworkObjectTypes.mockRejectedValue(new Error("down"));
    const degraded = await composeArtworksPage(services, {});
    expect(degraded.objectTypeTiles).toEqual([]);
    expect(degraded.mediumOptions).toHaveLength(6);
  });

  it("gives a medium landing an image hero from its cover and no tile rail", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworkObjectTypes.mockResolvedValue({
      items: [
        { objectType: "painting", artworkCount: 2, coverImageUrl: "https://cdn.test/p.webp" },
        { objectType: "print", artworkCount: 5, coverImageUrl: null },
      ],
    });

    const paintings = await composeArtworksPage(services, { objectType: "painting" });
    expect(paintings.landingHero).toEqual({
      title: "Paintings",
      description: expect.stringContaining("Original paintings"),
      imageUrl: "https://cdn.test/p.webp",
    });
    expect(paintings.objectTypeTiles).toEqual([]);
    expect(services.catalogue.listArtworks).toHaveBeenLastCalledWith({
      limit: 24,
      objectTypes: ["painting"],
    });

    const prints = await composeArtworksPage(services, { objectType: "print" });
    expect(prints.landingHero).toBeNull();
    expect(prints.title).toBe("Prints");
  });
});

describe("composeArtworksPageMetadata", () => {
  it("canonicalises landing media to their legacy URL with their own copy", () => {
    expect(composeArtworksPageMetadata({ objectType: "print", sort: "priceAsc" })).toEqual({
      title: "Art Prints for Sale | LAX Art",
      description: expect.stringContaining("art prints"),
      canonical: "/prints",
    });
  });

  it("keeps every other view on /artworks", () => {
    expect(composeArtworksPageMetadata({ type: "edition" })).toEqual({
      title: "Prints & Multiples | LAX Art",
      canonical: "/artworks",
    });
    expect(composeArtworksPageMetadata({ objectType: "photography" }).canonical).toBe("/artworks");
  });
});
