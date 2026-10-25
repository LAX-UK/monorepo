import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { buildHomePageViewModel } from "./home-page.vm.js";

function edition(slug: string, imageUrl: string | null = `/${slug}.webp`): PublicArtworkSummary {
  return {
    slug,
    title: slug,
    artistName: "Emmett King",
    artistSlug: "emmett-king",
    imageUrl,
    saleState: "for_sale",
    dimensions: null,
    dimensionsCmDisplay: null,
    medium: null,
    yearCreated: null,
    objectType: "print",
    rarity: "limited_edition",
    salesChannel: "shop",
    eligibleForEditionAllocation: true,
    printPricePence: 12000,
    availability: { totalEditions: 24, state: "available" },
  } as PublicArtworkSummary;
}

const base = { editions: [], artists: [], artistCount: null, sectionErrors: {} };

describe("buildHomePageViewModel", () => {
  it("names what Shop sells and counts the artists only when the count is known", () => {
    expect(buildHomePageViewModel({ ...base, artistCount: 3 }).hero).toMatchObject({
      title: "Limited editions and prints",
      lead: "Prints by 3 artists, each from a limited edition with its size stated. Prices include VAT.",
      primary: { label: "Browse editions", href: "/artworks" },
    });
    expect(buildHomePageViewModel({ ...base, artistCount: 1 }).hero.lead).toMatch(
      /^Prints by one artist/,
    );
    expect(buildHomePageViewModel(base).hero.lead).not.toMatch(/\d/);
  });

  it("features the first edition with an image, and leaves it out of the grid", () => {
    const editions = ["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((slug) => edition(slug));
    editions[0] = edition("a", null);
    const vm = buildHomePageViewModel({ ...base, editions });
    expect(vm.hero.feature?.slug).toBe("b");
    expect(vm.editions.map((item) => item.slug)).toEqual(["a", "c", "d", "e", "f", "g", "h", "i"]);
  });

  it("leaves out a section with fewer than three editions", () => {
    const vm = buildHomePageViewModel({ ...base, editions: [edition("a"), edition("b")] });
    expect(vm.hero.feature?.slug).toBe("a");
    expect(vm.editions).toEqual([]);
    // Three on sale: the grid keeps the featured one rather than drop to two.
    const three = buildHomePageViewModel({
      ...base,
      editions: [edition("a"), edition("b"), edition("c")],
    });
    expect(three.editions.map((item) => item.slug)).toEqual(["a", "b", "c"]);
  });

  it("lists only artists with editions", () => {
    const vm = buildHomePageViewModel({
      ...base,
      artists: [
        { slug: "a", name: "A", discipline: null, portraitUrl: null, artworkCount: 2 },
        { slug: "b", name: "B", discipline: null, portraitUrl: null, artworkCount: 0 },
      ],
    });
    expect(vm.artists.map((artist) => artist.href)).toEqual(["/artists/a"]);
  });

  it("explains editions without claiming anything the catalogue does not record", () => {
    const copy = buildHomePageViewModel(base)
      .steps.map((step) => `${step.title} ${step.body}`)
      .join(" ");
    expect(copy).not.toMatch(/signed|hand-?numbered/i);
    expect(copy).toContain("£15.00");
  });
});
