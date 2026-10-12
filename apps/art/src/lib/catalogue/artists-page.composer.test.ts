import { artistSummary, fakeArtServices } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import {
  ARTISTS_LETTER_PAGE_LIMIT,
  composeArtistsPage,
  parseArtistLetter,
} from "./artists-page.composer.js";

describe("composeArtistsPage", () => {
  it("pages the full directory newest-first by cursor", async () => {
    const { catalogue } = fakeArtServices();
    catalogue.listArtists.mockResolvedValue({ items: [artistSummary()], nextCursor: "c2" });

    const vm = await composeArtistsPage(catalogue, { cursor: "c1" });

    expect(catalogue.listArtists).toHaveBeenCalledWith({ limit: 24, cursor: "c1" });
    expect(vm).toMatchObject({ letter: null, nextPageHref: "/artists?cursor=c2", failed: false });
  });

  it("lists a letter by name without a pager and ignores the cursor", async () => {
    const { catalogue } = fakeArtServices();
    catalogue.listArtists.mockResolvedValue({ items: [], nextCursor: "ignored" });

    const vm = await composeArtistsPage(catalogue, { letter: "f", cursor: "c1" });

    expect(catalogue.listArtists).toHaveBeenCalledWith({
      limit: ARTISTS_LETTER_PAGE_LIMIT,
      letter: "F",
      sort: "nameAsc",
    });
    expect(vm).toMatchObject({ letter: "F", nextPageHref: null });
  });

  it("adds the curated featured strip on the unfiltered first page only", async () => {
    const { catalogue } = fakeArtServices();
    catalogue.listArtists.mockImplementation(async (query) => ({
      items: [artistSummary({ slug: query.placement ? "featured" : "listed" })],
    }));

    const first = await composeArtistsPage(catalogue, {});
    expect(catalogue.listArtists).toHaveBeenCalledWith({
      limit: 6,
      placement: "featured_artists",
    });
    expect(first.featured.map((card) => card.slug)).toEqual(["featured"]);
    expect(first.cards.map((card) => card.slug)).toEqual(["listed"]);

    catalogue.listArtists.mockClear();
    const paged = await composeArtistsPage(catalogue, { cursor: "c1" });
    expect(paged.featured).toEqual([]);
    expect(catalogue.listArtists).toHaveBeenCalledTimes(1);
  });

  it("keeps the directory when the featured read fails", async () => {
    const { catalogue } = fakeArtServices();
    catalogue.listArtists.mockImplementation(async (query) => {
      if (query.placement) throw new Error("down");
      return { items: [artistSummary()] };
    });
    const vm = await composeArtistsPage(catalogue, {});
    expect(vm).toMatchObject({ featured: [], failed: false });
    expect(vm.cards).toHaveLength(1);
  });

  it("reports failure without throwing", async () => {
    const { catalogue } = fakeArtServices();
    catalogue.listArtists.mockRejectedValue(new Error("down"));
    expect(await composeArtistsPage(catalogue, { letter: "z" })).toEqual({
      letter: "Z",
      cards: [],
      featured: [],
      nextPageHref: null,
      failed: true,
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
