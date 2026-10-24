import { describe, expect, it } from "vitest";
import { buildCatalogueArtistCards } from "./catalogue-artist-card.vm.js";
import { toCatalogueArtworkCardVm } from "./catalogue-artwork-card.vm.js";
import { buildCatalogueCategoryCards } from "./catalogue-category-card.vm.js";

describe("catalogue card view models", () => {
  it("maps artwork media and sold-out state for home and catalogue surfaces", () => {
    expect(
      toCatalogueArtworkCardVm({
        slug: "work",
        title: "Work",
        artistName: "Artist",
        artistSlug: "artist",
        imageUrl: "/work.webp",
        saleState: "for_sale",
        dimensions: "40 × 50 cm",
        yearCreated: 2026,
        medium: null,
        salesChannel: "shop",
        eligibleForEditionAllocation: true,
        printPricePence: null,
        availability: { totalEditions: 24, state: "sold_out" },
      }),
    ).toMatchObject({
      href: "/artworks/work",
      imageAlt: "Work by Artist",
      status: { label: "Sold out", tone: "neutral" },
      dimensions: "40 × 50 cm",
      metaLine: "Limited edition of 24 · Sold out",
    });
  });

  it("shows listed price on cards when the work is for sale", () => {
    expect(
      toCatalogueArtworkCardVm({
        slug: "harbor-print",
        title: "Harbor Print",
        artistName: "Flora Powers",
        artistSlug: "flora-powers",
        imageUrl: null,
        saleState: "for_sale",
        dimensions: null,
        yearCreated: null,
        medium: null,
        salesChannel: "shop",
        eligibleForEditionAllocation: true,
        printPricePence: 85000,
        availability: { totalEditions: 12, state: "available" },
      }).metaLine,
    ).toMatch(/^£850/);
  });

  it("maps artist and category media through shared catalogue view models", () => {
    expect(
      buildCatalogueArtistCards([
        {
          slug: "artist",
          name: "Artist",
          discipline: null,
          portraitUrl: null,
          artworkCount: 2,
        },
      ])[0],
    ).toMatchObject({ href: "/artists/artist", discipline: "Artist" });
    expect(
      buildCatalogueCategoryCards([
        {
          slug: "prints",
          label: "Prints",
          imageUrl: "/prints.webp",
          artworkCount: 3,
        },
      ])[0],
    ).toMatchObject({ href: "/categories/prints", image: "/prints.webp" });
  });
});
