import {
  SIGNED_IN_VIEWER,
  artistSummary,
  artworkSummary,
  fakeArtServices,
} from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import { composeArtHomePage } from "./home-page.composer.js";

describe("composeArtHomePage", () => {
  it("requests featured originals and artists for guests without a favorites read", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks.mockResolvedValue({ items: [artworkSummary()] });
    services.catalogue.listArtists.mockResolvedValue({ items: [artistSummary()] });

    const vm = await composeArtHomePage(services);

    expect(services.catalogue.listArtworks).toHaveBeenCalledWith({
      limit: 8,
      placement: "featured_originals",
      type: "original",
    });
    expect(services.favorites.savedArtworkSlugs).not.toHaveBeenCalled();
    expect(vm.featuredArtworks[0]).toMatchObject({ slug: "warm-basket", saved: false });
    expect(vm.featuredArtists[0]).toMatchObject({ href: "/artists/flora-powers" });
    expect(vm.favoriteAuth).toEqual({ signedIn: false, loginHref: "/login?returnTo=%2F" });
    expect(vm.sectionErrors).toEqual([]);
  });

  it("marks saved works for signed-in viewers", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.catalogue.listArtworks.mockResolvedValue({ items: [artworkSummary()] });
    services.favorites.savedArtworkSlugs.mockResolvedValue(new Set(["warm-basket"]));

    const vm = await composeArtHomePage(services);

    expect(vm.featuredArtworks[0]?.saved).toBe(true);
    expect(vm.favoriteAuth.signedIn).toBe(true);
  });

  it("degrades per section when the catalogue fails", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks.mockRejectedValue(new Error("down"));

    const vm = await composeArtHomePage(services);

    expect(vm.featuredArtworks).toEqual([]);
    expect(vm.sectionErrors).toEqual(["artworks"]);
  });
});
