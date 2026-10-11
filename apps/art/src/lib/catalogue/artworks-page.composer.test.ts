import { SIGNED_IN_VIEWER, artworkSummary, fakeArtServices } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import { composeArtworksPage } from "./artworks-page.composer.js";

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
});
