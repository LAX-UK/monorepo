import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { sortSaleLots } from "./sort-sale-lots.js";

function mkLot(id: string, lotNumber: number, currentPrice: string): Lot {
  return {
    id,
    lotNumber,
    currentPrice,
    endTime: new Date("2026-06-02T12:00:00.000Z"),
  } as Lot;
}

describe("sortSaleLots", () => {
  it("sorts by lot number by default", () => {
    const lots = [mkLot("c", 3, "1"), mkLot("a", 1, "1"), mkLot("b", 2, "1")];
    expect(sortSaleLots(lots).map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by price ascending", () => {
    const lots = [mkLot("high", 1, "300"), mkLot("low", 2, "100")];
    expect(sortSaleLots(lots, "priceAsc").map((l) => l.id)).toEqual(["low", "high"]);
  });
});
