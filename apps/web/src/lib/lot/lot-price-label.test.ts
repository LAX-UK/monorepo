import { describe, expect, it } from "vitest";
import { lotLifecycleIsClosed, lotPriceLabel } from "./lot-price-label";

describe("lotPriceLabel", () => {
  it("uses live words only while bidding is open", () => {
    expect(lotPriceLabel("live", true).label).toBe("Current bid");
    expect(lotPriceLabel("live", false).label).toBe("Starting bid");
    expect(lotPriceLabel("scheduled", false).label).toBe("Starting bid");
  });

  it("reports a sold lot's hammer price and an unsold lot without a price", () => {
    expect(lotPriceLabel("endedSold", true)).toEqual({
      label: "Hammer price",
      value: { kind: "amount" },
    });
    expect(lotPriceLabel("endedNoSale", false)).toEqual({
      label: "Result",
      value: { kind: "text", text: "Not sold" },
    });
  });

  it("knows when bidding is over", () => {
    expect(lotLifecycleIsClosed("endedSold")).toBe(true);
    expect(lotLifecycleIsClosed("withdrawn")).toBe(true);
    expect(lotLifecycleIsClosed("live")).toBe(false);
    expect(lotLifecycleIsClosed("saleroomPaused")).toBe(false);
  });
});
