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
      saleState: "for_sale",
      minPrice: "100",
      sort: "priceAsc",
    });

    expect(services.catalogue.listArtworks).toHaveBeenCalledWith({
      limit: 24,
      saleState: "for_sale",
      minPrice: 10000,
      sort: "priceAsc",
    });
    expect(vm.resultCount).toBe(30);
    expect(vm.hasActiveFilters).toBe(true);
    expect(vm.categories).toEqual([{ slug: "painting", label: "Painting" }]);
    expect(vm.nextPageHref).toBe(
      "/artworks?saleState=for_sale&minPrice=100&sort=priceAsc&cursor=c2",
    );
    expect(vm.favoriteAuth.loginHref).toBe(
      "/login?returnTo=%2Fartworks%3FsaleState%3Dfor_sale%26minPrice%3D100%26sort%3DpriceAsc",
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

    const sculptures = await composeArtworksPage(services, { objectType: "sculpture" });
    expect(sculptures.landingHero).toBeNull();
    expect(sculptures.title).toBe("Sculptures");
  });
});

describe("composeArtworksPageMetadata", () => {
  it("canonicalises landing media to their legacy URL with their own copy", () => {
    expect(composeArtworksPageMetadata({ objectType: "sculpture", sort: "priceAsc" })).toEqual({
      title: "Sculptures for Sale | lax.art",
      description: expect.stringContaining("sculpture"),
      canonical: "/sculptures",
    });
  });

  it("keeps every other view on /artworks, prints included: prints are LAX Shop's", () => {
    expect(composeArtworksPageMetadata({ type: "edition" })).toEqual({
      title: "Artworks | lax.art",
      canonical: "/artworks",
    });
    expect(composeArtworksPageMetadata({ objectType: "print" }).canonical).toBe("/artworks");
    expect(composeArtworksPageMetadata({ objectType: "photography" }).canonical).toBe("/artworks");
  });
});
