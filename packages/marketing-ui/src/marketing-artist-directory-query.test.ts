import { describe, expect, it } from "vitest";
import {
  marketingArtistDirectoryControls,
  marketingArtistDirectoryHref,
  parseMarketingArtistDirectoryQuery,
} from "./marketing-artist-directory-query.js";

describe("parseMarketingArtistDirectoryQuery", () => {
  it("keeps only known, valid values", () => {
    expect(
      parseMarketingArtistDirectoryQuery({
        q: "  rowan ",
        letter: ["F"],
        sort: "recent",
        show: "featured",
        cursor: "c1",
      }),
    ).toEqual({ q: "rowan", letter: "f", sort: "recent", show: "featured", cursor: "c1" });
    expect(
      parseMarketingArtistDirectoryQuery({ letter: "ab", sort: "popular", show: "all" }),
    ).toEqual({});
  });
});

describe("marketingArtistDirectoryHref", () => {
  it("drops the cursor when a filter changes and removes null keys", () => {
    const query = { q: "a b", letter: "c", cursor: "c1" };
    expect(marketingArtistDirectoryHref("/artists", query, { sort: "recent" })).toBe(
      "/artists?q=a+b&letter=c&sort=recent",
    );
    expect(marketingArtistDirectoryHref("/artists", query, { q: null, letter: null })).toBe(
      "/artists",
    );
    expect(marketingArtistDirectoryHref("/artists", query, { cursor: "c2" })).toBe(
      "/artists?q=a+b&letter=c&cursor=c2",
    );
  });
});

describe("marketingArtistDirectoryControls", () => {
  it("marks the active options and builds removable chips", () => {
    const controls = marketingArtistDirectoryControls("/artists", {
      show: "featured",
      letter: "m",
      sort: "recent",
    });
    expect(controls.railGroups[0]?.links.find((l) => l.active)?.label).toBe("Featured artists");
    expect(controls.sortLinks.find((l) => l.active)?.label).toBe("Recently added");
    expect(controls.activeChips.map((c) => c.label)).toEqual(["Featured artists", "Starts with M"]);
    expect(controls.activeCount).toBe(2);
    expect(controls.clearHref).toBe("/artists?sort=recent");
  });
});
