import { hangLot } from "@/lib/hang/hang-fixtures";
import { catalogueOrder, soldOrder } from "@/lib/home-sections/lot-order";
import { describe, expect, it } from "vitest";

const ids = (lots: { id: string }[]) => lots.map((lot) => lot.id);

describe("catalogueOrder", () => {
  it("reads by lot number, with photographed lots first", () => {
    const lots = [
      hangLot({ id: "c", lotNumber: 3 }),
      hangLot({ id: "a", lotNumber: 1, images: [] }),
      hangLot({ id: "b", lotNumber: 2 }),
    ];
    expect(ids(catalogueOrder(lots, []))).toEqual(["b", "c", "a"]);
  });

  it("leads with the lots staff featured, in staff order", () => {
    const lots = [
      hangLot({ id: "a", lotNumber: 1 }),
      hangLot({ id: "b", lotNumber: 2 }),
      hangLot({ id: "c", lotNumber: 3 }),
    ];
    expect(ids(catalogueOrder(lots, ["c", "missing", "a"]))).toEqual(["c", "a", "b"]);
  });

  it("puts lots without a number last", () => {
    const lots = [hangLot({ id: "x", lotNumber: null }), hangLot({ id: "y", lotNumber: 9 })];
    expect(ids(catalogueOrder(lots, []))).toEqual(["y", "x"]);
  });
});

describe("soldOrder", () => {
  it("keeps sold lots only, best price first", () => {
    const lots = [
      hangLot({ id: "low", status: "ended", winnerId: "u", currentPrice: "500.00" }),
      hangLot({ id: "unsold", status: "ended", winnerId: null, currentPrice: "9000.00" }),
      hangLot({ id: "high", status: "ended", winnerId: "u", currentPrice: "7750.00" }),
      hangLot({ id: "live", status: "active", currentPrice: "100000.00" }),
    ];
    expect(ids(soldOrder(lots))).toEqual(["high", "low"]);
  });
});
