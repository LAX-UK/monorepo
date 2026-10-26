import type { PublicArtistSummary, PublicArtworkSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { buildHeaderSearchGroups, parseHeaderSearchQuery } from "./header-search.vm";

function edition(
  slug: string,
  state: "available" | "sold_out",
  price = 8500,
): PublicArtworkSummary {
  return {
    slug,
    title: slug.replace("-", " "),
    artistName: "Emmett King",
    artistSlug: "emmett-king",
    imageUrl: `/shop/${slug}.webp`,
    saleState: "for_sale",
    dimensions: null,
    dimensionsCmDisplay: null,
    medium: null,
    yearCreated: null,
    objectType: "print",
    rarity: "limited_edition",
    salesChannel: "shop",
    eligibleForEditionAllocation: true,
    printPricePence: price,
    availability: { totalEditions: 24, state },
    updatedAt: "2026-10-20T10:00:00.000Z",
  } as PublicArtworkSummary;
}

const artist = (slug: string, artworkCount: number): PublicArtistSummary => ({
  slug,
  name: slug,
  discipline: null,
  portraitUrl: null,
  artworkCount,
});

describe("parseHeaderSearchQuery", () => {
  it("accepts 2 to 80 characters after trimming", () => {
    expect(parseHeaderSearchQuery("  em ")).toBe("em");
    expect(parseHeaderSearchQuery("e")).toBeNull();
    expect(parseHeaderSearchQuery(null)).toBeNull();
    expect(parseHeaderSearchQuery("x".repeat(81))).toBeNull();
  });
});

describe("buildHeaderSearchGroups", () => {
  it("lists available editions first with artist and price, then artists with editions", () => {
    const groups = buildHeaderSearchGroups({
      editions: [edition("quiet-field", "sold_out"), edition("warm-basket", "available", 12000)],
      artists: [artist("emmett-king", 3), artist("no-editions", 0)],
    });
    expect(groups.map((group) => group.title)).toEqual(["Editions", "Artists"]);
    expect(groups[0]?.items).toEqual([
      {
        id: "warm-basket",
        label: "warm basket",
        detail: "Emmett King · £120.00",
        href: "/artworks/warm-basket",
        imageUrl: "/shop/warm-basket.webp",
      },
      {
        id: "quiet-field",
        label: "quiet field",
        detail: "Emmett King · Sold out",
        href: "/artworks/quiet-field",
        imageUrl: "/shop/quiet-field.webp",
      },
    ]);
    expect(groups[1]?.items).toEqual([
      {
        id: "emmett-king",
        label: "emmett-king",
        detail: "3 editions",
        href: "/artists/emmett-king",
        imageUrl: null,
        imageShape: "circle",
      },
    ]);
  });

  it("caps editions at five and leaves empty groups out", () => {
    const groups = buildHeaderSearchGroups({
      editions: Array.from({ length: 8 }, (_, index) => edition(`print-${index}`, "available")),
      artists: [],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items).toHaveLength(5);
    expect(buildHeaderSearchGroups({ editions: [], artists: [] })).toEqual([]);
  });
});
