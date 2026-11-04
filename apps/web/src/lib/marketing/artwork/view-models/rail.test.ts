import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { mapSiblingsToRailVM } from "./rail";

function lot(id: string, overrides: Partial<Lot> = {}): Lot {
  return {
    id,
    saleId: "sale-1",
    title: `Lot ${id}`,
    lotNumber: 1,
    images: [],
    currentPrice: "100.00",
    endTime: null,
    status: "active",
    sellerId: "seller-1",
    artistId: null,
    bidCount: 0,
    marketingDetails: {},
    ...overrides,
  } as unknown as Lot;
}

const SALE = { id: "sale-1", title: "Autumn sale" };

describe("mapSiblingsToRailVM", () => {
  it("shows the artist the resolver names and never the consignor", () => {
    const current = lot("current", { artistId: "artist-1" });
    const sibling = lot("a", { artistId: "artist-1", sellerId: "seller-9" });
    const other = lot("b", { artistId: "artist-2", sellerId: "seller-9" });

    const rail = mapSiblingsToRailVM(current, SALE, [current, sibling, other], [], (l) =>
      l.artistId === "artist-1" ? "Ada Moore" : null,
    );

    expect(rail.cards.map((card) => card.artistName)).toEqual(["Ada Moore", null]);
    expect(JSON.stringify(rail)).not.toMatch(/Private seller/);
  });

  it("falls back to the seller's other lots with a heading that names no person", () => {
    const current = lot("current", { saleId: null });
    const rail = mapSiblingsToRailVM(current, null, null, [lot("a")], () => null);

    expect(rail.heading).toBe("More from this seller");
    expect(rail.cards).toHaveLength(1);
  });
});
