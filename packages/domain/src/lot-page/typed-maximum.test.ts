import { describe, expect, it } from "vitest";
import { amountsWithinLimit, limitCovers } from "./bid-ladder.js";
import { isLargeMaximum, parseTypedAmount, snapTypedMaximum } from "./typed-maximum.js";

const lot = {
  auctionType: "english",
  currentPrice: "7000.00",
  startingPrice: "4200.00",
  minBidIncrement: "250.00",
} as const;

describe("parseTypedAmount", () => {
  it("reads pounds with commas, a pound sign and pence", () => {
    expect(parseTypedAmount("49,600")).toBe("49600.00");
    expect(parseTypedAmount(" £9000.5 ")).toBe("9000.50");
  });

  it("rejects anything that is not an amount", () => {
    for (const text of ["", "abc", "-5", "0", "12.345", "1e5", "9,00,0x"]) {
      expect(parseTypedAmount(text)).toBeNull();
    }
  });
});

describe("snapTypedMaximum", () => {
  it("keeps an amount that is already a valid step", () => {
    expect(snapTypedMaximum(lot, "9000")).toEqual({
      kind: "ok",
      typed: "9000.00",
      snapped: "9000.00",
      exact: true,
    });
  });

  it("snaps down to the nearest step at or below what was typed, never up", () => {
    expect(snapTypedMaximum(lot, "49,600")).toMatchObject({ snapped: "49500.00", exact: false });
    expect(snapTypedMaximum(lot, "7499.99")).toMatchObject({ snapped: "7250.00" });
  });

  it("accepts exactly the next bid", () => {
    expect(snapTypedMaximum(lot, "7250")).toMatchObject({ snapped: "7250.00", exact: true });
  });

  it("says when the amount is below the next bid", () => {
    expect(snapTypedMaximum(lot, "7249")).toEqual({ kind: "below_next", nextBid: "7250.00" });
  });

  it("tells empty from invalid", () => {
    expect(snapTypedMaximum(lot, "  ")).toEqual({ kind: "empty" });
    expect(snapTypedMaximum(lot, "lots")).toEqual({ kind: "invalid" });
  });
});

describe("limits for a typed maximum", () => {
  it("is over an agent's limit when the snapped amount exceeds what is left", () => {
    const snapped = snapTypedMaximum(lot, "9,300");
    expect(snapped.kind).toBe("ok");
    if (snapped.kind === "ok") {
      expect(limitCovers("9000.00", snapped.snapped)).toBe(false);
      expect(limitCovers("9000.00", "9000.00")).toBe(true);
    }
    expect(amountsWithinLimit(["9000.00", "9250.00"], "9000.00")).toEqual(["9000.00"]);
  });
});

describe("isLargeMaximum", () => {
  it("asks again over ten times the high estimate", () => {
    expect(isLargeMaximum({ amount: "90000.01", estimateHigh: "9000", nextBid: "7250.00" })).toBe(
      true,
    );
    expect(isLargeMaximum({ amount: "90000.00", estimateHigh: "9000", nextBid: "7250.00" })).toBe(
      false,
    );
  });

  it("falls back to the next bid when there is no estimate", () => {
    expect(isLargeMaximum({ amount: "72501.00", estimateHigh: null, nextBid: "7250.00" })).toBe(
      true,
    );
    expect(isLargeMaximum({ amount: "9000.00", estimateHigh: null, nextBid: "7250.00" })).toBe(
      false,
    );
  });
});
