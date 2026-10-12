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

  it("reports failure without throwing", async () => {
    const { catalogue } = fakeArtServices();
    catalogue.listArtists.mockRejectedValue(new Error("down"));
    expect(await composeArtistsPage(catalogue, { letter: "z" })).toEqual({
      letter: "Z",
      cards: [],
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
