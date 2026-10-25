import { SIGNED_IN_VIEWER, artistSummary, fakeArtServices } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import { composeArtistsPage, parseArtistLetter } from "./artists-page.composer.js";

describe("composeArtistsPage", () => {
  it("lists artists A–Z by default and passes the page cursor and total through", async () => {
    const services = fakeArtServices();
    const { catalogue } = services;
    catalogue.listArtists.mockResolvedValue({
      items: [artistSummary()],
      total: 30,
      nextCursor: "c2",
    });

    const vm = await composeArtistsPage(services, { cursor: "c1" });

    expect(catalogue.listArtists).toHaveBeenCalledWith({
      limit: 24,
      sort: "nameAsc",
      cursor: "c1",
    });
    expect(vm).toMatchObject({ total: 30, nextCursor: "c2", failed: false });
    expect(vm.query).toEqual({ cursor: "c1" });
  });

  it("applies search, letter, featured and the recent sort", async () => {
    const services = fakeArtServices();
    const { catalogue } = services;
    catalogue.listArtists.mockResolvedValue({ items: [] });

    const vm = await composeArtistsPage(services, {
      q: " rowan ",
      letter: "f",
      show: "featured",
      sort: "recent",
    });

    expect(catalogue.listArtists).toHaveBeenCalledWith({
      limit: 24,
      placement: "featured_artists",
      q: "rowan",
      letter: "F",
      sort: "newest",
    });
    expect(vm).toMatchObject({ total: null, nextCursor: null, cards: [] });
  });

  it("reports failure without throwing", async () => {
    const services = fakeArtServices();
    const { catalogue } = services;
    catalogue.listArtists.mockRejectedValue(new Error("down"));
    expect(await composeArtistsPage(services, { letter: "z" })).toEqual({
      query: { letter: "z" },
      cards: [],
      total: null,
      nextCursor: null,
      failed: true,
      favoriteAuth: { signedIn: false, loginHref: "/login?returnTo=%2Fartists%3Fletter%3Dz" },
    });
  });

  it("seeds Follow buttons from one followed-artists read for signed-in viewers", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.catalogue.listArtists.mockResolvedValue({
      items: [artistSummary({ slug: "a" }), artistSummary({ slug: "b" })],
    });
    services.favorites.followedArtistSlugs.mockResolvedValue(new Set(["b"]));

    const vm = await composeArtistsPage(services, {});

    expect(services.favorites.followedArtistSlugs).toHaveBeenCalledTimes(1);
    expect(services.favorites.savedArtworkSlugs).not.toHaveBeenCalled();
    expect(vm.cards.map((card) => card.following)).toEqual([false, true]);
    expect(vm.favoriteAuth.signedIn).toBe(true);
  });

  it("skips the favourites read for guests and returns them to the page they were on", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtists.mockResolvedValue({ items: [artistSummary()] });

    const vm = await composeArtistsPage(services, { cursor: "c 2" });

    expect(services.favorites.followedArtistSlugs).not.toHaveBeenCalled();
    expect(vm.cards[0]?.following).toBe(false);
    expect(vm.favoriteAuth).toEqual({
      signedIn: false,
      loginHref: "/login?returnTo=%2Fartists%3Fcursor%3Dc%2B2",
    });
  });
});

describe("parseArtistLetter", () => {
  it("accepts a single latin letter only", () => {
    expect(parseArtistLetter(["b"])).toBe("B");
    expect(parseArtistLetter("ab")).toBeNull();
    expect(parseArtistLetter("1")).toBeNull();
    expect(parseArtistLetter(undefined)).toBeNull();
  });
});
