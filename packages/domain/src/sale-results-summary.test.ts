import { describe, expect, it } from "vitest";
import {
  EXTERNAL_RESULTS_SETTLING_MS,
  type SaleResultLot,
  type SaleResultsSaleContext,
  saleHasResultsPhase,
  summariseSaleResults,
} from "./sale-results-summary.js";

const NOW = new Date("2026-11-01T12:00:00Z");
const SALE_END = new Date("2026-10-31T18:00:00Z");

const sale: SaleResultsSaleContext = {
  status: "ended",
  endTime: SALE_END,
  externalState: null,
  externalResultsLanded: false,
};

function lot(overrides: Partial<SaleResultLot> & { id: string }): SaleResultLot {
  return {
    status: "ended",
    currentPrice: "100.00",
    hasWinner: true,
    endTime: SALE_END,
    extendedUntil: null,
    external: false,
    externalSold: false,
    ...overrides,
  };
}

/** Flat 20% premium. */
const withPremium = (l: SaleResultLot) => (Number.parseFloat(l.currentPrice) * 1.2).toFixed(2);

const summarise = (lots: SaleResultLot[], saleOverride: Partial<SaleResultsSaleContext> = {}) =>
  summariseSaleResults({ sale: { ...sale, ...saleOverride }, lots, now: NOW, withPremium });

describe("saleHasResultsPhase", () => {
  it("is true once the sale has ended, or its external auction has", () => {
    expect(saleHasResultsPhase({ status: "ended", externalState: null })).toBe(true);
    expect(saleHasResultsPhase({ status: "draft", externalState: "ended" })).toBe(true);
  });

  it("is false before that", () => {
    expect(saleHasResultsPhase({ status: "active", externalState: null })).toBe(false);
    expect(saleHasResultsPhase({ status: "draft", externalState: "live" })).toBe(false);
  });
});

describe("summariseSaleResults", () => {
  it("has no summary before the sale ends", () => {
    expect(summarise([lot({ id: "a" })], { status: "active" })).toBeNull();
  });

  it("is final with sold of total, the total with premium and the top lot", () => {
    const result = summarise([
      lot({ id: "a", currentPrice: "100.00" }),
      lot({ id: "b", currentPrice: "500.00" }),
      lot({ id: "c", hasWinner: false, currentPrice: "50.00" }),
    ]);
    expect(result).toEqual({
      state: "final",
      lotCount: 3,
      soldCount: 2,
      currency: "GBP",
      totalWithPremium: "720.00",
      topLot: { lotId: "b", priceWithPremium: "600.00" },
      endedAt: SALE_END.toISOString(),
    });
  });

  it("is final with no top lot when nothing sold", () => {
    const result = summarise([lot({ id: "a", hasWinner: false })]);
    expect(result).toMatchObject({
      state: "final",
      lotCount: 1,
      soldCount: 0,
      totalWithPremium: "0.00",
      topLot: null,
    });
  });

  it("is finalising while a lot is still bidding, with no figures", () => {
    const result = summarise([
      lot({ id: "a" }),
      lot({ id: "b", status: "active", extendedUntil: new Date("2026-11-01T12:05:00Z") }),
    ]);
    expect(result).toEqual({ state: "finalising", pendingLotCount: 1 });
  });

  it("does not count withdrawn, voided, draft or scheduled lots", () => {
    const result = summarise([
      lot({ id: "a" }),
      lot({ id: "w", status: "cancelled" }),
      lot({ id: "v", status: "voided" }),
      lot({ id: "d", status: "draft" }),
      lot({ id: "s", status: "scheduled" }),
    ]);
    expect(result).toMatchObject({ state: "final", lotCount: 1, soldCount: 1 });
  });

  it("reports the close of the last lot, including an extension", () => {
    const extended = new Date("2026-10-31T18:07:00Z");
    const result = summarise([lot({ id: "a" }), lot({ id: "b", extendedUntil: extended })]);
    expect(result).toMatchObject({ endedAt: extended.toISOString() });
  });

  it("ignores an extension earlier than the scheduled close", () => {
    const result = summarise([lot({ id: "a", extendedUntil: new Date("2026-10-31T10:00:00Z") })]);
    expect(result).toMatchObject({ endedAt: SALE_END.toISOString() });
  });

  it("falls back to the sale's end when no lot counts", () => {
    expect(summarise([])).toMatchObject({
      state: "final",
      lotCount: 0,
      endedAt: SALE_END.toISOString(),
    });
  });

  it("sums without floating point drift", () => {
    const cents = (l: SaleResultLot) => l.currentPrice;
    const result = summariseSaleResults({
      sale,
      now: NOW,
      withPremium: cents,
      lots: [lot({ id: "a", currentPrice: "0.10" }), lot({ id: "b", currentPrice: "0.20" })],
    });
    expect(result).toMatchObject({ totalWithPremium: "0.30" });
  });
});

describe("summariseSaleResults for an externally run sale", () => {
  const closed: Partial<SaleResultsSaleContext> = {
    status: "draft",
    externalState: "ended",
    externalResultsLanded: true,
  };
  const external = (id: string, sold: boolean) =>
    lot({ id, status: "draft", external: true, externalSold: sold, hasWinner: false });

  it("is final once the results have landed, counting the lots sold there", () => {
    const result = summarise([external("a", true), external("b", false)], closed);
    expect(result).toMatchObject({
      state: "final",
      lotCount: 2,
      soldCount: 1,
      totalWithPremium: "120.00",
    });
  });

  it("is finalising while the auction is still live on ATG", () => {
    const result = summarise([external("a", false)], { ...closed, externalState: "live" });
    expect(result).toBeNull();
    const pending = summarise([external("a", false)], {
      status: "ended",
      externalState: "live",
    });
    expect(pending).toEqual({ state: "finalising", pendingLotCount: 1 });
  });

  it("is finalising when the auction closed recently and no result has landed", () => {
    const result = summarise([external("a", false)], { ...closed, externalResultsLanded: false });
    expect(result).toEqual({ state: "finalising", pendingLotCount: 1 });
  });

  it("is final with nothing sold once the settling window has passed", () => {
    const old = new Date(NOW.getTime() - EXTERNAL_RESULTS_SETTLING_MS - 1000);
    const result = summarise([external("a", false)], {
      ...closed,
      externalResultsLanded: false,
      endTime: old,
    });
    expect(result).toMatchObject({ state: "final", lotCount: 1, soldCount: 0 });
  });
});
