import { SIGNED_IN_VIEWER, artworkSummary, fakeArtServices } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import { composeArtistMetadataTitle, composeArtistPage } from "./artist-page.composer.js";

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
    await expect(composeArtistPage(fakeArtServices(), "nobody")).resolves.toEqual({
      kind: "not_found",
    });
  });

  it("lists the artist's works and skips favorites reads for guests", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtist.mockResolvedValue(artist);
    services.catalogue.listArtworks.mockResolvedValue({ items: [artworkSummary()] });

    const result = await composeArtistPage(services, "flora-powers");

    if (result.kind !== "ok") throw new Error("expected ok");
    expect(services.catalogue.listArtworks).toHaveBeenCalledWith({
      artistSlug: "flora-powers",
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

    const result = await composeArtistPage(services, "flora-powers");

    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.following).toBe(true);
    expect(result.vm.worksFailed).toBe(true);
  });

  it("builds the metadata title", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtist.mockResolvedValue(artist);
    await expect(composeArtistMetadataTitle(services.catalogue, "flora-powers")).resolves.toBe(
      "Flora Powers | LAX Art",
    );
  });
});
