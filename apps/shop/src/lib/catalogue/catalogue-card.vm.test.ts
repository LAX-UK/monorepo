import { describe, expect, it } from "vitest";
import { buildCatalogueArtistCards } from "./catalogue-artist-card.vm.js";
import { toCatalogueArtworkCardVm } from "./catalogue-artwork-card.vm.js";
import { buildCatalogueCategoryCards } from "./catalogue-category-card.vm.js";

describe("catalogue card view models", () => {
  it("maps artwork media and sale state for home and catalogue surfaces", () => {
    expect(
      toCatalogueArtworkCardVm({
        slug: "work",
        title: "Work",
        artistName: "Artist",
        imageUrl: "/work.webp",
        saleState: "price_on_application",
        dimensions: "40 × 50 cm",
        yearCreated: 2026,
        eligibleForEditionAllocation: false,
        printPricePence: null,
        availability: { totalEditions: 0, editionsAvailable: 0 },
      }),
    ).toMatchObject({
      href: "/artworks/work",
      imageAlt: "Work by Artist",
      status: {
        label: "Price on request",
        tone: "accent",
        hint: "Contact LAX and we will share the price for this work.",
      },
      dimensions: "40 × 50 cm",
      metaLine: "Original — one of one",
    });
  });

  it("prefers sold out over price on request when editions are claimed", () => {
    expect(
      toCatalogueArtworkCardVm({
        slug: "vessel",
        title: "Vessel Study",
        artistName: "Flora Powers",
        imageUrl: null,
        saleState: "price_on_application",
        dimensions: null,
        yearCreated: null,
        eligibleForEditionAllocation: true,
        printPricePence: null,
        availability: { totalEditions: 24, editionsAvailable: 0 },
      }).status,
    ).toEqual({ label: "Sold out", tone: "neutral" });
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
