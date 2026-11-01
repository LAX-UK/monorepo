import { describe, expect, it } from "vitest";
import { parseSaleResultsSummary } from "./sale-results-summary";

describe("parseSaleResultsSummary", () => {
  it("reads a final summary", () => {
    const raw = {
      state: "final",
      lotCount: 24,
      soldCount: 18,
      currency: "GBP",
      totalWithPremium: "186400.00",
      topLot: null,
      endedAt: "2026-10-15T17:00:00.000Z",
    };
    expect(parseSaleResultsSummary(raw)).toEqual({
      state: "final",
      lotCount: 24,
      soldCount: 18,
      currency: "GBP",
      totalWithPremium: "186400.00",
      endedAt: "2026-10-15T17:00:00.000Z",
    });
  });

  it("reads a finalising summary", () => {
    expect(parseSaleResultsSummary({ state: "finalising", pendingLotCount: 3 })).toEqual({
      state: "finalising",
      pendingLotCount: 3,
    });
  });

  it.each([null, undefined, "final", {}, { state: "final", lotCount: 1 }])(
    "treats %j as no summary",
    (raw) => {
      expect(parseSaleResultsSummary(raw)).toBeUndefined();
    },
  );
});
