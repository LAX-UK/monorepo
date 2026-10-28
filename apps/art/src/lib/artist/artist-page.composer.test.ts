import { SIGNED_IN_VIEWER, artworkSummary, fakeArtServices } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import { composeArtistMetadata, composeArtistPage } from "./artist-page.composer.js";

const SITE_URL = new URL("https://www.thelax.art/");

const artist = {
  slug: "flora-powers",
  name: "Flora Powers",
  discipline: "Painter",
  bio: "Works in oil.",
  portraitUrl: null,
  artworkCount: 1,
};

describe("composeArtistPage", () => {
  it("returns not_found for unknown artists", async () => {
    await expect(composeArtistPage(fakeArtServices(), "nobody", SITE_URL)).resolves.toEqual({
      kind: "not_found",
    });
  });

  it("lists the artist's works and skips favorites reads for guests", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtist.mockResolvedValue(artist);
    services.catalogue.listArtworks.mockResolvedValue({ items: [artworkSummary()] });

    const result = await composeArtistPage(services, "flora-powers", SITE_URL);

    if (result.kind !== "ok") throw new Error("expected ok");
    // lax.art lists originals only, so one read gives the featured works.
    expect(services.catalogue.listArtworks).toHaveBeenCalledTimes(1);
    expect(services.catalogue.listArtworks).toHaveBeenCalledWith({
      artistSlugs: ["flora-powers"],
      limit: 8,
    });
    expect(services.favorites.followedArtistSlugs).not.toHaveBeenCalled();
    expect(result.vm).toMatchObject({
      name: "Flora Powers",
      portraitAlt: "Portrait of Flora Powers",
      following: false,
      worksFailed: false,
    });
    expect(result.vm.favoriteAuth.loginHref).toBe("/login?returnTo=%2Fartists%2Fflora-powers");
  });

  it("reflects follow state for signed-in viewers and survives a works failure", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.catalogue.getArtist.mockResolvedValue(artist);
    services.catalogue.listArtworks.mockRejectedValue(new Error("down"));
    services.favorites.followedArtistSlugs.mockResolvedValue(new Set(["flora-powers"]));

    const result = await composeArtistPage(services, "flora-powers", SITE_URL);

    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.following).toBe(true);
    expect(result.vm.worksFailed).toBe(true);
  });

  it("maps hero, life line, exhibitions and stories into the profile", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtist.mockResolvedValue({
      ...artist,
      heroUrl: "https://cdn.example.test/hero.jpg",
      nationality: "French",
      birthYear: 1869,
      deathYear: 1954,
    });
    services.catalogue.listArtworks.mockResolvedValue({ items: [artworkSummary()] });
    services.editorial.getArtistRelations.mockResolvedValue({
      status: "ok",
      data: {
        exhibitions: [
          {
            slug: "water-lilies",
            kind: "exhibition",
            title: "Water Lilies",
            summary: null,
            startsOn: "2026-03-12",
            endsOn: "2026-05-04",
            coverUrl: null,
            featured: false,
          },
        ],
        stories: [
          {
            slug: "in-the-studio",
            kind: "film",
            title: "In the studio",
            standfirst: null,
            coverUrl: null,
            featured: false,
          },
        ],
      },
    });

    const result = await composeArtistPage(services, "flora-powers", SITE_URL);

    if (result.kind !== "ok") throw new Error("expected ok");
    expect(services.editorial.getArtistRelations).toHaveBeenCalledWith("flora-powers");
    expect(result.vm).toMatchObject({
      heroUrl: "https://cdn.example.test/hero.jpg",
      lifeLine: "French, 1869–1954",
    });
    expect(result.vm.exhibitions.map((card) => card.headline)).toEqual(["Water Lilies"]);
    expect(result.vm.stories.map((card) => card.headline)).toEqual(["In the studio"]);
    expect(result.vm.sectionTabs.map((tab) => tab.label)).toEqual([
      "Featured works",
      "Exhibitions",
      "Films & stories",
    ]);
  });

  it.each([
    ["is disabled", () => Promise.resolve({ status: "disabled" as const })],
    ["errors", () => Promise.resolve({ status: "error" as const })],
    ["rejects", () => Promise.reject(new Error("down"))],
  ])("hides only the editorial sections when relations %s", async (_label, relations) => {
    const services = fakeArtServices();
    services.catalogue.getArtist.mockResolvedValue(artist);
    services.catalogue.listArtworks.mockResolvedValue({ items: [artworkSummary()] });
    services.editorial.getArtistRelations.mockImplementation(relations);

    const result = await composeArtistPage(services, "flora-powers", SITE_URL);

    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.exhibitions).toEqual([]);
    expect(result.vm.stories).toEqual([]);
    expect(result.vm.works).toHaveLength(1);
    expect(result.vm.heroUrl).toBeNull();
    expect(result.vm.lifeLine).toBeNull();
  });

  it("links to the artist's Shop editions only when the Shop has some", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtist.mockResolvedValue(artist);
    services.ecosystem.crossProductLinks.mockReturnValue([
      {
        id: "shop",
        label: "LAX Shop",
        href: "https://shop.example/",
        current: false,
        external: true,
      },
    ]);

    const none = await composeArtistPage(services, "flora-powers", SITE_URL);
    if (none.kind !== "ok") throw new Error("expected ok");
    expect(none.vm.crossLinks).toEqual([]);

    services.catalogue.listShopEditionsByArtist.mockResolvedValue({ items: [artworkSummary()] });
    const some = await composeArtistPage(services, "flora-powers", SITE_URL);
    if (some.kind !== "ok") throw new Error("expected ok");
    expect(services.catalogue.listShopEditionsByArtist).toHaveBeenCalledWith("flora-powers", 1);
    expect(some.vm.crossLinks).toEqual([
      expect.objectContaining({
        label: "Editions by Flora Powers in LAX Shop",
        href: "https://shop.example/artists/flora-powers",
      }),
    ]);
  });

  it("shows no section tabs when the works are the only section", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtist.mockResolvedValue(artist);
    services.catalogue.listArtworks.mockResolvedValue({ items: [artworkSummary()] });

    const result = await composeArtistPage(services, "flora-powers", SITE_URL);

    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.sectionTabs).toEqual([]);
  });

  it("builds generated metadata", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtist.mockResolvedValue({ ...artist, bio: null, shortBio: null });
    await expect(composeArtistMetadata(services.catalogue, "flora-powers")).resolves.toEqual({
      kind: "ok",
      title: "Flora Powers | lax.art",
      description: "Discover works by Flora Powers at lax.art.",
      canonicalPath: "/artists/flora-powers",
    });
  });

  it("separates a missing artist from an unreachable catalogue", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtist.mockResolvedValueOnce(null);
    await expect(composeArtistMetadata(services.catalogue, "gone")).resolves.toEqual({
      kind: "not_found",
    });
    services.catalogue.getArtist.mockRejectedValueOnce(new Error("shop-api down"));
    await expect(composeArtistMetadata(services.catalogue, "flora-powers")).resolves.toEqual({
      kind: "unavailable",
    });
  });

  it("prefers imported SEO overrides", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtist.mockResolvedValue({
      ...artist,
      seoTitle: "Flora Powers Paintings | lax.art",
      seoDescription: "Browse original paintings by Flora Powers.",
    });
    await expect(composeArtistMetadata(services.catalogue, "flora-powers")).resolves.toEqual({
      kind: "ok",
      title: "Flora Powers Paintings | lax.art",
      description: "Browse original paintings by Flora Powers.",
      canonicalPath: "/artists/flora-powers",
    });
  });
});
