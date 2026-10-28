import type { PublicArtistDetail, PublicArtistSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { buildHomeArtists, chooseHomeArtists, homeArtistsLayout } from "./home-artists";

const artist = (
  slug: string,
  overrides: Partial<PublicArtistSummary> = {},
): PublicArtistSummary => ({
  slug,
  name: slug,
  discipline: "Painter",
  portraitUrl: null,
  artworkCount: 2,
  ...overrides,
});

const many = (count: number) => Array.from({ length: count }, (_, i) => artist(`a${i + 1}`));

describe("homeArtistsLayout", () => {
  it("hides at none, features one, pairs two, rows three or four and rails from five", () => {
    expect([0, 1, 2, 3, 4, 5, 8, 12].map(homeArtistsLayout)).toEqual([
      null,
      "feature",
      "pair",
      "row",
      "row",
      "rail",
      "rail",
      "rail",
    ]);
  });
});

describe("chooseHomeArtists", () => {
  it("puts featured artists first, then the newest, each once, eight at most", () => {
    const chosen = chooseHomeArtists([artist("f1"), artist("a2")], many(10));
    expect(chosen.map((a) => a.slug)).toEqual(["f1", "a2", "a1", "a3", "a4", "a5", "a6", "a7"]);
  });

  it("leaves out an artist with nothing in the Shop", () => {
    expect(chooseHomeArtists([artist("none", { artworkCount: 0 })], [artist("a")])).toEqual([
      artist("a"),
    ]);
  });
});

describe("buildHomeArtists", () => {
  const artBaseUrl = new URL("https://art.test");

  it("is hidden with no artists, rather than showing an empty row", () => {
    expect(buildHomeArtists({ artists: [], total: 0, soloDetail: null, artBaseUrl })).toBeNull();
  });

  it("features a single artist with their profile facts, bio and both doors", () => {
    const detail = {
      slug: "flora-powers",
      name: "Flora Powers",
      discipline: "Painter",
      bio: null,
      shortBio: "Paints vessels in broken colour.",
      portraitUrl: null,
      nationality: "British",
      birthYear: 1979,
      deathYear: null,
      artworkCount: 4,
      seoTitle: null,
      seoDescription: null,
    } satisfies PublicArtistDetail;
    const vm = buildHomeArtists({
      artists: [artist("flora-powers", { name: "Flora Powers", artworkCount: 4 })],
      total: 1,
      soloDetail: detail,
      artBaseUrl,
    });
    expect(vm?.layout).toBe("feature");
    expect(vm?.viewAll).toBeNull();
    expect(vm?.solo).toMatchObject({
      factsLine: "British · b. 1979 · Painter",
      shortBio: "Paints vessels in broken colour.",
      countLabel: "4 editions in the Shop",
      editionsLink: { label: "Editions by Flora Powers", href: "/artists/flora-powers" },
      profileHref: "https://art.test/artists/flora-powers",
    });
  });

  it("features a single artist without a profile, leaving out what is not known", () => {
    const vm = buildHomeArtists({
      artists: [artist("juno", { discipline: null })],
      total: 1,
      soloDetail: null,
      artBaseUrl: null,
    });
    expect(vm?.solo).toMatchObject({ factsLine: null, shortBio: null, profileHref: null });
  });

  it("pairs two artists with no link beside the title", () => {
    const vm = buildHomeArtists({ artists: many(2), total: 2, soloDetail: null, artBaseUrl });
    expect(vm?.layout).toBe("pair");
    expect(vm?.viewAll).toBeNull();
    expect(vm?.solo).toBeNull();
  });

  it("links a row or rail to every artist, with the count when more exist", () => {
    expect(
      buildHomeArtists({ artists: many(3), total: 3, soloDetail: null, artBaseUrl })?.viewAll,
    ).toEqual({ label: "All artists", href: "/artists" });
    const rail = buildHomeArtists({ artists: many(8), total: 12, soloDetail: null, artBaseUrl });
    expect(rail?.layout).toBe("rail");
    expect(rail?.cards).toHaveLength(8);
    expect(rail?.viewAll).toEqual({ label: "All 12 artists", href: "/artists" });
    expect(rail?.laxArtHref).toBe("https://art.test/artists");
  });
});
