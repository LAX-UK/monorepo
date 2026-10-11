import { artistSummary, artworkSummary, fakeArtServices } from "@/lib/testing/fake-art-services";
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
