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
    expect(services.catalogue.listArtworks).toHaveBeenCalledWith({
      artistSlugs: ["flora-powers"],
      limit: 24,
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

  it("builds generated metadata", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtist.mockResolvedValue({ ...artist, bio: null, shortBio: null });
    await expect(composeArtistMetadata(services.catalogue, "flora-powers")).resolves.toEqual({
      kind: "ok",
      title: "Flora Powers | LAX Art",
      description: "Discover works by Flora Powers at LAX Art.",
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
      seoTitle: "Flora Powers Paintings | The LAX Art",
      seoDescription: "Browse original paintings by Flora Powers.",
    });
    await expect(composeArtistMetadata(services.catalogue, "flora-powers")).resolves.toEqual({
      kind: "ok",
      title: "Flora Powers Paintings | The LAX Art",
      description: "Browse original paintings by Flora Powers.",
      canonicalPath: "/artists/flora-powers",
    });
  });
});
