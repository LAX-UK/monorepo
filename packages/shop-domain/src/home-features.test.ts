import { describe, expect, it } from "vitest";
import {
  type FeaturedPrintFacts,
  type HomeFeatureTargetFacts,
  canLeadHomeRelease,
  chooseHomeRelease,
  featuredArtistPresence,
  featuredPrintRoles,
  homeFeatureLimit,
  homeFeatureListIssues,
  isHomeFeatureSlot,
  planHomeFeatures,
} from "./home-features.js";

const ids = (count: number) => Array.from({ length: count }, (_, index) => `id-${index}`);

function facts(...items: HomeFeatureTargetFacts[]): Map<string, HomeFeatureTargetFacts> {
  return new Map(items.map((item) => [item.id, item]));
}

const artist = (id: string): HomeFeatureTargetFacts => ({ kind: "artist", id });
const print = (id: string, isShopEdition = true): HomeFeatureTargetFacts => ({
  kind: "artwork",
  id,
  isShopEdition,
});

describe("home feature slots", () => {
  it("curates prints, artists and categories, never originals", () => {
    expect(isHomeFeatureSlot("featured_artists")).toBe(true);
    expect(isHomeFeatureSlot("featured_originals")).toBe(false);
  });

  it("holds at most 8 artists, shared by the Shop and lax.art", () => {
    expect(homeFeatureLimit("featured_artists")).toBe(8);
  });
});

describe("homeFeatureListIssues", () => {
  it("flags a record chosen twice at its second place", () => {
    expect(homeFeatureListIssues("featured_artists", ["a", "b", "a"])).toEqual([
      { index: 2, targetId: "a", reason: "duplicate" },
    ]);
  });

  it("flags every artist past the eighth", () => {
    const issues = homeFeatureListIssues("featured_artists", ids(10));
    expect(issues.map((issue) => [issue.index, issue.reason])).toEqual([
      [8, "over_limit"],
      [9, "over_limit"],
    ]);
  });

  it("accepts an empty list", () => {
    expect(homeFeatureListIssues("featured_prints", [])).toEqual([]);
  });
});

describe("planHomeFeatures", () => {
  it("places records in the order given", () => {
    const plan = planHomeFeatures("featured_artists", ["b", "a"], facts(artist("a"), artist("b")));
    expect(plan).toEqual({
      ok: true,
      placements: [
        { slot: "featured_artists", position: 0, target: { kind: "artist", id: "b" } },
        { slot: "featured_artists", position: 1, target: { kind: "artist", id: "a" } },
      ],
    });
  });

  it("refuses a record that does not exist or is of another kind", () => {
    const plan = planHomeFeatures("featured_artists", ["a", "p"], facts(print("p")));
    expect(plan).toEqual({
      ok: false,
      issues: [
        { index: 0, targetId: "a", reason: "unknown" },
        { index: 1, targetId: "p", reason: "unknown" },
      ],
    });
  });

  it("refuses an original in the prints list", () => {
    const plan = planHomeFeatures("featured_prints", ["o"], facts(print("o", false)));
    expect(plan).toEqual({
      ok: false,
      issues: [{ index: 0, targetId: "o", reason: "not_a_shop_edition" }],
    });
  });

  it("reports a duplicate without also looking it up", () => {
    const nine = ids(9);
    const plan = planHomeFeatures(
      "featured_artists",
      [...nine.slice(0, 8), "id-0"],
      facts(...nine.map(artist)),
    );
    expect(plan).toEqual({
      ok: false,
      issues: [{ index: 8, targetId: "id-0", reason: "duplicate" }],
    });
  });

  it("clears a slot with an empty list", () => {
    expect(planHomeFeatures("featured_categories", [], new Map())).toEqual({
      ok: true,
      placements: [],
    });
  });
});

describe("featuredPrintRoles", () => {
  const ready = { live: true, soldOut: false, hasImage: true };

  it("leads with the first print on sale with an image, and keeps the rest in line", () => {
    expect(
      featuredPrintRoles([
        { ...ready, soldOut: true },
        { ...ready, hasImage: false },
        ready,
        ready,
      ]),
    ).toEqual(["sold_out", "no_image", "home_release", "next_in_line"]);
  });

  it("skips works the Shop does not show without counting them", () => {
    expect(
      featuredPrintRoles([{ ...ready, live: false }, ready, ready, ready, ready, ready]),
    ).toEqual([
      "not_live",
      "home_release",
      "next_in_line",
      "next_in_line",
      "next_in_line",
      "beyond_candidates",
    ]);
  });

  it("has no release when no candidate qualifies", () => {
    expect(featuredPrintRoles([{ ...ready, soldOut: true }])).toEqual(["sold_out"]);
  });
});

describe("chooseHomeRelease", () => {
  type Item = { slug: string } & FeaturedPrintFacts;
  const item = (slug: string, over: Partial<FeaturedPrintFacts> = {}): Item => ({
    slug,
    live: true,
    soldOut: false,
    hasImage: true,
    ...over,
  });
  const soldOut = item("sold", { soldOut: true });
  const noImage = item("no-image", { hasImage: false });
  const choose = (placed: Item[], newest: Item[]) =>
    chooseHomeRelease(placed, newest, (entry) => entry);

  it("takes the first placed edition that can be bought and has an image", () => {
    const live = item("live");
    expect(choose([soldOut, noImage, live], [])).toEqual({ item: live, featured: true });
  });

  it("falls back to the newest edition on sale with an image", () => {
    const newest = item("newest");
    expect(choose([soldOut], [noImage, soldOut, newest])).toEqual({
      item: newest,
      featured: false,
    });
  });

  it("never leads with a sold-out work or one without an image", () => {
    expect(choose([soldOut, noImage], [soldOut, noImage])).toBeNull();
  });

  it("reads only the first placed prints, as the admin status says", () => {
    const fifth = item("fifth");
    const newest = item("newest");
    expect(choose([soldOut, soldOut, noImage, noImage, fifth], [newest])).toEqual({
      item: newest,
      featured: false,
    });
  });

  it("leads with the print the admin marks as the home release", () => {
    const lists: Item[][] = [
      [soldOut, item("a"), item("b")],
      [item("draft", { live: false }), noImage, item("c")],
      [soldOut, noImage],
    ];
    for (const placed of lists) {
      const roles = featuredPrintRoles(placed);
      const marked = placed[roles.indexOf("home_release")];
      expect(choose(placed, [])?.item).toBe(marked);
    }
  });

  it("agrees with canLeadHomeRelease", () => {
    expect(canLeadHomeRelease(item("x"))).toBe(true);
    expect(canLeadHomeRelease(soldOut)).toBe(false);
    expect(canLeadHomeRelease(noImage)).toBe(false);
    expect(canLeadHomeRelease(item("draft", { live: false }))).toBe(false);
  });
});

describe("featuredArtistPresence", () => {
  it("lists lax.art and the Shop when the artist is on both", () => {
    expect(featuredArtistPresence({ onArt: true, hasEditionsOnSale: true })).toEqual([
      "on_art",
      "on_shop",
    ]);
  });

  it("says the Shop leaves out an artist with no editions on sale", () => {
    expect(featuredArtistPresence({ onArt: true, hasEditionsOnSale: false })).toEqual([
      "on_art",
      "not_on_shop",
    ]);
    expect(featuredArtistPresence({ onArt: false, hasEditionsOnSale: false })).toEqual([
      "not_on_shop",
    ]);
  });
});
