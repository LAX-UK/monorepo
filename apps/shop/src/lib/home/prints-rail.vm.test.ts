import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  PRINTS_RAIL_TARGET_COUNT,
  buildPrintRailCards,
  catalogueItemToPrintCard,
} from "./prints-rail.vm.js";

const item = (
  slug: string,
  overrides: Partial<PublicArtworkSummary> = {},
): PublicArtworkSummary => ({
  slug,
  title: `Title ${slug}`,
  artistName: "Artist",
  imageUrl: null,
  saleState: "for_sale",
  dimensions: null,
  yearCreated: null,
  eligibleForEditionAllocation: true,
  printPricePence: 12000,
  availability: { totalEditions: 24, editionsAvailable: 4 },
  ...overrides,
});

describe("buildPrintRailCards", () => {
  it("returns up to five catalogue cards when API is sufficient", () => {
    const cards = buildPrintRailCards([
      item("a"),
      item("b"),
      item("c"),
      item("d"),
      item("e"),
      item("f"),
    ]);
    expect(cards).toHaveLength(PRINTS_RAIL_TARGET_COUNT);
    expect(cards.every((c) => c.id.startsWith("catalogue-"))).toBe(true);
  });

  it("shows only live catalogue cards without editorial fallbacks", () => {
    const cards = buildPrintRailCards([item("warm-basket")]);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.id).toBe("catalogue-warm-basket");
  });

  it("keeps original works out of the Prints rail", () => {
    const cards = buildPrintRailCards([
      item("print"),
      item("original", { eligibleForEditionAllocation: false }),
    ]);
    expect(cards.map((card) => card.id)).toEqual(["catalogue-print"]);
  });

  it("maps catalogue slugs to artwork links", () => {
    const card = catalogueItemToPrintCard(item("demo-slug"));
    expect(card.href).toBe("/artworks/demo-slug");
    expect(card.imageAlt).toContain("Title demo-slug");
  });
});
