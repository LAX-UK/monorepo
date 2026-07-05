import { describe, expect, it } from "vitest";
import { lotNumberTakenInSale, nextLotNumberInSale } from "./lot-number.js";

describe("lot-number", () => {
  it("lotNumberTakenInSale ignores excluded lot id", () => {
    const lots = [
      { id: "a", lotNumber: 5 },
      { id: "b", lotNumber: 7 },
    ] as never[];
    expect(lotNumberTakenInSale(lots, 5, "a")).toBe(false);
    expect(lotNumberTakenInSale(lots, 5, "b")).toBe(true);
  });

  it("nextLotNumberInSale excludes self and returns max + 1", () => {
    const lots = [
      { id: "a", lotNumber: 3 },
      { id: "b", lotNumber: 7 },
      { id: "c", lotNumber: null },
    ] as never[];
    expect(nextLotNumberInSale(lots, "a")).toBe(8);
  });
});
