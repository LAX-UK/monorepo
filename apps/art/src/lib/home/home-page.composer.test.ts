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
    expect(services.favorites.followedArtistSlugs).not.toHaveBeenCalled();
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

  it("marks followed featured artists from one read for signed-in viewers", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.catalogue.listArtists.mockResolvedValue({ items: [artistSummary()] });
    services.favorites.followedArtistSlugs.mockResolvedValue(new Set(["flora-powers"]));

    const vm = await composeArtHomePage(services);

    expect(vm.featuredArtists[0]?.following).toBe(true);
    expect(services.favorites.followedArtistSlugs).toHaveBeenCalledTimes(1);
  });

  it("degrades per section when the catalogue fails", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks.mockRejectedValue(new Error("down"));

    const vm = await composeArtHomePage(services);

    expect(vm.featuredArtworks).toEqual([]);
    expect(vm.sectionErrors).toEqual(["artworks"]);
  });

  it("falls back to the newest Art items when Shop-curated placements hold none", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [artworkSummary()] });
    services.catalogue.listArtists
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [artistSummary()] });

    const vm = await composeArtHomePage(services);

    expect(services.catalogue.listArtworks).toHaveBeenLastCalledWith({
      limit: 8,
      type: "original",
    });
    expect(services.catalogue.listArtists).toHaveBeenLastCalledWith({ limit: 6 });
    expect(vm.featuredArtworks).toHaveLength(1);
    expect(vm.featuredArtists).toHaveLength(1);
  });
});

describe("composeArtHomePage editorial", () => {
  it("maps placements to hero and section cards", async () => {
    const services = fakeArtServices();
    services.editorial.home.mockResolvedValue({
      status: "ok",
      data: {
        placements: [
          {
            slot: "home_hero",
            position: 0,
            headline: "Summer show",
            mediaUrl: "https://cdn.test/hero.jpg",
            linkUrl: null,
            refKind: "exhibition",
            refSlug: "summer-show",
          },
          {
            slot: "home_whats_on",
            position: 0,
            headline: null,
            mediaUrl: null,
            linkUrl: "/visit",
            refKind: "external",
            refSlug: null,
          },
        ],
      },
    });

    const vm = await composeArtHomePage(services);

    expect(vm.editorial).toMatchObject({
      kind: "ok",
      hero: { headline: "Summer show", href: "/exhibitions/summer-show" },
      whatsOn: [{ headline: "What's on", href: "/visit" }],
      stories: [],
    });
  });

  it("hides editorial when disabled and flags failures", async () => {
    const services = fakeArtServices();
    expect((await composeArtHomePage(services)).editorial).toEqual({ kind: "hidden" });
    services.editorial.home.mockResolvedValue({ status: "error" });
    expect((await composeArtHomePage(services)).editorial).toEqual({ kind: "failed" });
  });
});
