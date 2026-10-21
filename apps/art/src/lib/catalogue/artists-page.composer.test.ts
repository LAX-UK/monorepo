import { SIGNED_IN_VIEWER, artistSummary, fakeArtServices } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import {
  ARTISTS_LETTER_PAGE_LIMIT,
  composeArtistsPage,
  parseArtistLetter,
} from "./artists-page.composer.js";

describe("composeArtistsPage", () => {
  it("pages the full directory newest-first by cursor", async () => {
    const services = fakeArtServices();
    const { catalogue } = services;
    catalogue.listArtists.mockResolvedValue({ items: [artistSummary()], nextCursor: "c2" });

    const vm = await composeArtistsPage(services, { cursor: "c1" });

    expect(catalogue.listArtists).toHaveBeenCalledWith({ limit: 24, cursor: "c1" });
    expect(vm).toMatchObject({ letter: null, nextPageHref: "/artists?cursor=c2", failed: false });
  });

  it("lists a letter by name without a pager and ignores the cursor", async () => {
    const services = fakeArtServices();
    const { catalogue } = services;
    catalogue.listArtists.mockResolvedValue({ items: [], nextCursor: "ignored" });

    const vm = await composeArtistsPage(services, { letter: "f", cursor: "c1" });

    expect(catalogue.listArtists).toHaveBeenCalledWith({
      limit: ARTISTS_LETTER_PAGE_LIMIT,
      letter: "F",
      sort: "nameAsc",
    });
    expect(vm).toMatchObject({ letter: "F", nextPageHref: null });
  });

  it("adds the curated featured strip on the unfiltered first page only", async () => {
    const services = fakeArtServices();
    const { catalogue } = services;
    catalogue.listArtists.mockImplementation(async (query) => ({
      items: [artistSummary({ slug: query.placement ? "featured" : "listed" })],
    }));

    const first = await composeArtistsPage(services, {});
    expect(catalogue.listArtists).toHaveBeenCalledWith({
      limit: 6,
      placement: "featured_artists",
    });
    expect(first.featured.map((card) => card.slug)).toEqual(["featured"]);
    expect(first.cards.map((card) => card.slug)).toEqual(["listed"]);

    catalogue.listArtists.mockClear();
    const paged = await composeArtistsPage(services, { cursor: "c1" });
    expect(paged.featured).toEqual([]);
    expect(catalogue.listArtists).toHaveBeenCalledTimes(1);
  });

  it("keeps the directory when the featured read fails", async () => {
    const services = fakeArtServices();
    const { catalogue } = services;
    catalogue.listArtists.mockImplementation(async (query) => {
      if (query.placement) throw new Error("down");
      return { items: [artistSummary()] };
    });
    const vm = await composeArtistsPage(services, {});
    expect(vm).toMatchObject({ featured: [], failed: false });
    expect(vm.cards).toHaveLength(1);
  });

  it("reports failure without throwing", async () => {
    const services = fakeArtServices();
    const { catalogue } = services;
    catalogue.listArtists.mockRejectedValue(new Error("down"));
    expect(await composeArtistsPage(services, { letter: "z" })).toEqual({
      letter: "Z",
      cards: [],
      featured: [],
      nextPageHref: null,
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
    expect(vm.featured.map((card) => card.following)).toEqual([false, true]);
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
      loginHref: "/login?returnTo=%2Fartists%3Fcursor%3Dc%25202",
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
