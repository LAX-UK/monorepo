import { describe, expect, it } from "vitest";
import { artistSectionTabs, artistWorksLayout, formatArtistLifeLine } from "./artist-profile.vm";

describe("formatArtistLifeLine", () => {
  it("joins nationality and a life span", () => {
    expect(formatArtistLifeLine({ nationality: "French", birthYear: 1869, deathYear: 1954 })).toBe(
      "French, 1869–1954",
    );
  });

  it("marks a living artist with b.", () => {
    expect(formatArtistLifeLine({ nationality: "British", birthYear: 1969, deathYear: null })).toBe(
      "British, b. 1969",
    );
  });

  it("omits missing parts", () => {
    expect(formatArtistLifeLine({ nationality: "French" })).toBe("French");
    expect(formatArtistLifeLine({ birthYear: 1869, deathYear: 1954 })).toBe("1869–1954");
    expect(formatArtistLifeLine({ nationality: "  ", deathYear: 1954 })).toBeNull();
    expect(formatArtistLifeLine({})).toBeNull();
  });
});

describe("artistSectionTabs", () => {
  it("lists rendered sections in page order", () => {
    expect(
      artistSectionTabs({ press: true, works: true, sold: true, stories: true }).map(
        (tab) => tab.label,
      ),
    ).toEqual(["Available works", "Sold works", "Films & stories", "Press"]);
  });

  it("returns none for a single section", () => {
    expect(artistSectionTabs({ works: true, exhibitions: false })).toEqual([]);
  });
});

describe("artistWorksLayout", () => {
  it.each([
    [0, null],
    [1, "single"],
    [2, "pair"],
    [3, "grid"],
    [8, "grid"],
  ] as const)("lays %i works out as %s", (count, layout) => {
    expect(artistWorksLayout(count)).toBe(layout);
  });
});
