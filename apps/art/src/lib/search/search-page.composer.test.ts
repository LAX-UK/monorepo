import {
  SIGNED_IN_VIEWER,
  artistSummary,
  artworkSummary,
  fakeArtServices,
} from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import { composeSearchPage, parseSearchQuery } from "./search-page.composer.js";

describe("composeSearchPage", () => {
  it("stays idle without a query and does not hit the catalogue", async () => {
    const services = fakeArtServices();
    const vm = await composeSearchPage(services, { q: "   " });
    expect(vm.status).toBe("idle");
    expect(services.catalogue.listArtworks).not.toHaveBeenCalled();
  });

  it("returns artworks and artists for a query", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks.mockResolvedValue({ items: [artworkSummary()] });
    services.catalogue.listArtists.mockResolvedValue({ items: [artistSummary()] });

    const vm = await composeSearchPage(services, { q: " basket " });

    expect(services.catalogue.listArtworks).toHaveBeenCalledWith({ q: "basket", limit: 12 });
    expect(services.catalogue.listArtists).toHaveBeenCalledWith({ q: "basket", limit: 6 });
    expect(vm).toMatchObject({
      query: "basket",
      status: "results",
      allArtworksHref: "/artworks?q=basket",
    });
    expect(vm.favoriteAuth.loginHref).toBe("/login?returnTo=%2Fsearch%3Fq%3Dbasket");
  });

  it("marks followed artists for signed-in viewers, and skips that read with no query", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.catalogue.listArtists.mockResolvedValue({ items: [artistSummary()] });
    services.favorites.followedArtistSlugs.mockResolvedValue(new Set(["flora-powers"]));

    await composeSearchPage(services, {});
    expect(services.favorites.followedArtistSlugs).not.toHaveBeenCalled();

    const vm = await composeSearchPage(services, { q: "flora" });
    expect(vm.artists[0]?.following).toBe(true);
    expect(services.favorites.followedArtistSlugs).toHaveBeenCalledTimes(1);
  });

  it("reports no results", async () => {
    const vm = await composeSearchPage(fakeArtServices(), { q: "zzzz" });
    expect(vm.status).toBe("no_results");
  });

  it("reports unavailable only when both reads fail", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks.mockRejectedValue(new Error("down"));
    services.catalogue.listArtists.mockRejectedValue(new Error("down"));
    expect((await composeSearchPage(services, { q: "x" })).status).toBe("unavailable");
  });

  it("caps the query length", () => {
    expect(parseSearchQuery("a".repeat(200))).toHaveLength(120);
    expect(parseSearchQuery(["first", "second"])).toBe("first");
  });
});
