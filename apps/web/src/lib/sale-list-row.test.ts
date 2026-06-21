import {
  formatSaleItemsLabel,
  formatSaleLotsLabel,
  parseSaleListRowApiPayload,
  resolveSaleLotCount,
} from "@/lib/sale-list-row";
import { describe, expect, it } from "vitest";

describe("resolveSaleLotCount", () => {
  it("returns numeric lotCount when finite and non-negative", () => {
    expect(resolveSaleLotCount(15, 4)).toBe(15);
    expect(resolveSaleLotCount("8", 4)).toBe(8);
    expect(resolveSaleLotCount(0, 4)).toBe(0);
  });

  it("falls back to preview length for invalid values", () => {
    expect(resolveSaleLotCount(undefined, 4)).toBe(4);
    expect(resolveSaleLotCount(null, 3)).toBe(3);
    expect(resolveSaleLotCount("bad", 2)).toBe(2);
    expect(resolveSaleLotCount(-1, 5)).toBe(5);
  });
});

describe("formatSaleItemsLabel", () => {
  it("singular and plural", () => {
    expect(formatSaleItemsLabel(1)).toBe("1 Item");
    expect(formatSaleItemsLabel(15)).toBe("15 Items");
  });
});

describe("formatSaleLotsLabel", () => {
  it("singular and plural", () => {
    expect(formatSaleLotsLabel(1)).toBe("1 lot");
    expect(formatSaleLotsLabel(10)).toBe("10 lots");
  });
});

describe("parseSaleListRowApiPayload", () => {
  it("parses sale, preview lots, and lotCount", () => {
    const row = parseSaleListRowApiPayload({
      sale: {
        id: "s1",
        title: "Test",
        status: "scheduled",
        deliveryMode: "online",
        startTime: "2026-04-09T10:00:00Z",
        endTime: "2026-04-16T18:00:00Z",
        coverImages: [],
        buyerPremiumRate: "0",
        createdAt: "2026-04-09T10:00:00Z",
        updatedAt: "2026-04-09T10:00:00Z",
      },
      lots: [{ id: "l1", lotNumber: 1, title: "Lot", status: "scheduled" }],
      lotCount: 12,
    });
    expect(row.sale.id).toBe("s1");
    expect(row.lots).toHaveLength(1);
    expect(row.lotCount).toBe(12);
  });

  it("falls back to lots.length when lotCount missing", () => {
    const row = parseSaleListRowApiPayload({
      sale: {
        id: "s2",
        title: "T",
        status: "scheduled",
        deliveryMode: "online",
        startTime: "2026-04-09T10:00:00Z",
        endTime: "2026-04-16T18:00:00Z",
        coverImages: [],
        buyerPremiumRate: "0",
        createdAt: "2026-04-09T10:00:00Z",
        updatedAt: "2026-04-09T10:00:00Z",
      },
      lots: [{ id: "a", lotNumber: 1, title: "A", status: "scheduled" }],
    });
    expect(row.lotCount).toBe(1);
  });
});
