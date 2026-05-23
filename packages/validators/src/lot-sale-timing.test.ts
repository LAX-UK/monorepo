import { describe, expect, it } from "vitest";
import {
  type LotSaleTimingWindow,
  alignLotTimingWithSale,
  lotTimingViolationAgainstSale,
  normalizeLotTimingForSale,
} from "./lot-sale-timing.js";

const saleStart = new Date("2026-06-01T10:00:00Z");
const saleEnd = new Date("2026-06-07T18:00:00Z");

const onlineSale: LotSaleTimingWindow = {
  deliveryMode: "online",
  startTime: saleStart,
  endTime: saleEnd,
};

const onsiteSale: LotSaleTimingWindow = {
  deliveryMode: "onsite",
  startTime: saleStart,
  endTime: saleEnd,
};

describe("alignLotTimingWithSale", () => {
  it("inherits sale window for onsite sales", () => {
    const lotStart = new Date("2026-06-02T10:00:00Z");
    const lotEnd = new Date("2026-06-03T18:00:00Z");
    expect(alignLotTimingWithSale(onsiteSale, lotStart, lotEnd)).toEqual({
      startTime: saleStart,
      endTime: saleEnd,
    });
  });

  it("keeps lot times for online sales", () => {
    const lotStart = new Date("2026-06-02T10:00:00Z");
    const lotEnd = new Date("2026-06-03T18:00:00Z");
    expect(alignLotTimingWithSale(onlineSale, lotStart, lotEnd)).toEqual({
      startTime: lotStart,
      endTime: lotEnd,
    });
  });
});

describe("lotTimingViolationAgainstSale", () => {
  it("accepts online lot times within the sale window", () => {
    expect(
      lotTimingViolationAgainstSale(
        onlineSale,
        new Date("2026-06-02T10:00:00Z"),
        new Date("2026-06-03T18:00:00Z"),
      ),
    ).toBeNull();
  });

  it("rejects online lot start before sale start", () => {
    expect(
      lotTimingViolationAgainstSale(
        onlineSale,
        new Date("2026-05-31T10:00:00Z"),
        new Date("2026-06-03T18:00:00Z"),
      ),
    ).toContain("before the sale start");
  });

  it("rejects online lot end after sale end", () => {
    expect(
      lotTimingViolationAgainstSale(
        onlineSale,
        new Date("2026-06-02T10:00:00Z"),
        new Date("2026-06-08T18:00:00Z"),
      ),
    ).toContain("after the sale end");
  });

  it("requires exact match for onsite sales", () => {
    expect(
      lotTimingViolationAgainstSale(
        onsiteSale,
        new Date("2026-06-02T10:00:00Z"),
        new Date("2026-06-03T18:00:00Z"),
      ),
    ).toContain("Onsite lots must use the sale");
  });
});

describe("normalizeLotTimingForSale", () => {
  it("coerces onsite lot to sale window without violation", () => {
    const result = normalizeLotTimingForSale(
      onsiteSale,
      new Date("2026-06-02T10:00:00Z"),
      new Date("2026-06-03T18:00:00Z"),
    );
    expect(result.startTime).toEqual(saleStart);
    expect(result.endTime).toEqual(saleEnd);
    expect(result.violation).toBeNull();
  });

  it("surfaces violation for online lot outside sale window", () => {
    const result = normalizeLotTimingForSale(
      onlineSale,
      new Date("2026-05-31T10:00:00Z"),
      new Date("2026-06-03T18:00:00Z"),
    );
    expect(result.violation).not.toBeNull();
  });
});
