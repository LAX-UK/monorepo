import { artistSummary } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import {
  buildSearchTabs,
  findExactArtistMatch,
  resolveActiveTab,
  searchEmptyCopy,
  searchResultCountLabel,
  searchTabLabel,
} from "./search-page.vm.js";
import { parseSearchParams } from "./search-params.js";

describe("search page VM", () => {
  it("labels tabs with a count only when it is known", () => {
    expect(searchTabLabel("available", 3)).toBe("Available (3)");
    expect(searchTabLabel("articles", null)).toBe("Articles");
  });

  it("builds tab links that keep the query and sort and leave out hidden sources", () => {
    const state = parseSearchParams({ q: "coin", sort: "titleAsc", cursor: "c1" });
    expect(
      buildSearchTabs(state, { available: 1, sold: 45, exhibitions: "hidden", articles: 2 }),
    ).toEqual([
      { id: "available", label: "Available (1)", href: "/search?q=coin&sort=titleAsc" },
      { id: "sold", label: "Sold (45)", href: "/search?q=coin&tab=sold&sort=titleAsc" },
      {
        id: "articles",
        label: "Articles (2)",
        href: "/search?q=coin&tab=articles&sort=titleAsc",
      },
    ]);
  });

  it("falls back to Available when the requested tab is hidden", () => {
    const counts = { available: 0, sold: 0, exhibitions: "hidden", articles: null } as const;
    expect(resolveActiveTab("exhibitions", counts)).toBe("available");
    expect(resolveActiveTab("articles", counts)).toBe("articles");
  });

  it("pluralises the result count", () => {
    expect(searchResultCountLabel(1)).toBe("1 result");
    expect(searchResultCountLabel(4)).toBe("4 results");
  });

  it("matches an artist name exactly, ignoring case and extra spaces", () => {
    const artists = [artistSummary({ name: "Mr Phantom", slug: "mr-phantom" })];
    expect(findExactArtistMatch(artists, "  mr   phantom ")).toEqual({
      name: "Mr Phantom",
      href: "/artists/mr-phantom",
    });
    expect(findExactArtistMatch(artists, "phantom")).toBeNull();
  });

  it("writes per-tab empty copy that points to filters when they are active", () => {
    expect(searchEmptyCopy("available", false)).toEqual({
      title: "No available items",
      description: "Try a different spelling or browse all artworks.",
    });
    expect(searchEmptyCopy("sold", true).description).toBe(
      "Try removing a filter or a different spelling.",
    );
  });
});
