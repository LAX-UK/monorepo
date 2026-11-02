import { artistSummary } from "@/lib/testing/fake-art-services";
import type { PublicArtistDetail } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { buildFeaturedArtists, featuredArtistNeedsDetail } from "./art-featured-artists.vm.js";

const flora = artistSummary();
const theo = artistSummary({ slug: "theo-marsh", name: "Theo Marsh", discipline: null });

function detail(overrides: Partial<PublicArtistDetail> = {}): PublicArtistDetail {
  return {
    slug: "flora-powers",
    name: "Flora Powers",
    discipline: "Painter",
    bio: null,
    shortBio: "  Paints quiet interiors in oil.  ",
    portraitUrl: null,
    nationality: "British",
    birthYear: 1979,
    deathYear: null,
    artworkCount: 3,
    ...overrides,
  } as PublicArtistDetail;
}

describe("buildFeaturedArtists", () => {
  it("hides the section with no artist", () => {
    expect(buildFeaturedArtists({ artists: [] })).toBeNull();
  });

  it("makes one artist a feature with facts and a trimmed short bio", () => {
    const vm = buildFeaturedArtists({ artists: [flora], soloDetail: detail() });
    expect(vm).toMatchObject({
      layout: "feature",
      solo: {
        factsLine: "British · b. 1979 · Painter",
        shortBio: "Paints quiet interiors in oil.",
        card: { href: "/artists/flora-powers", worksLabel: "3 works" },
      },
    });
  });

  it("keeps the feature when the detail is missing or belongs to another artist", () => {
    for (const soloDetail of [null, undefined, detail({ slug: "other" })]) {
      const vm = buildFeaturedArtists({ artists: [flora], soloDetail });
      expect(vm).toMatchObject({
        layout: "feature",
        solo: { factsLine: "Painter", shortBio: null },
      });
    }
  });

  it("makes two artists a pair with the discipline as facts", () => {
    const vm = buildFeaturedArtists({ artists: [flora, theo] });
    expect(vm).toMatchObject({
      layout: "pair",
      items: [{ factsLine: "Painter" }, { factsLine: null }],
    });
  });

  it("makes three or more artists a rail", () => {
    const vm = buildFeaturedArtists({ artists: [flora, theo, artistSummary({ slug: "c" })] });
    expect(vm).toMatchObject({ layout: "rail" });
    expect(vm && vm.layout === "rail" && vm.cards).toHaveLength(3);
  });

  it("marks following from the viewer's follows", () => {
    const vm = buildFeaturedArtists({ artists: [flora], followedSlugs: new Set(["flora-powers"]) });
    expect(vm).toMatchObject({ layout: "feature", solo: { card: { following: true } } });
  });
});

describe("featuredArtistNeedsDetail", () => {
  it("is true only for a single artist", () => {
    expect([0, 1, 2, 3].map(featuredArtistNeedsDetail)).toEqual([false, true, false, false]);
  });
});
