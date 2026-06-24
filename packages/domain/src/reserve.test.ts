import { describe, expect, it } from "vitest";
import {
  deriveNoSaleReason,
  deriveReserveStatus,
  hasConfiguredReserve,
  isReserveMet,
} from "./reserve.js";

describe("hasConfiguredReserve", () => {
  it("returns false for null, empty, and zero", () => {
    expect(hasConfiguredReserve(null)).toBe(false);
    expect(hasConfiguredReserve("")).toBe(false);
    expect(hasConfiguredReserve("0.00")).toBe(false);
  });

  it("returns true for positive reserve", () => {
    expect(hasConfiguredReserve("27000.00")).toBe(true);
    expect(hasConfiguredReserve("0.01")).toBe(true);
  });
});

describe("deriveReserveStatus", () => {
  it("returns none when no reserve", () => {
    expect(deriveReserveStatus("1101.00", null)).toEqual({ kind: "none" });
  });

  it("returns below when hammer under reserve", () => {
    expect(deriveReserveStatus("1101.00", "27000.00")).toEqual({
      kind: "below",
      hasReserve: true,
    });
  });

  it("returns met when hammer meets reserve", () => {
    expect(deriveReserveStatus("27000.00", "27000.00")).toEqual({
      kind: "met",
      hasReserve: true,
    });
    expect(deriveReserveStatus("28000.00", "27000.00")).toEqual({
      kind: "met",
      hasReserve: true,
    });
  });
});

describe("isReserveMet", () => {
  it("returns null when no reserve", () => {
    expect(isReserveMet("100.00", null)).toBeNull();
  });

  it("returns boolean when reserve configured", () => {
    expect(isReserveMet("1101.00", "27000.00")).toBe(false);
    expect(isReserveMet("27000.00", "27000.00")).toBe(true);
  });
});

describe("deriveNoSaleReason", () => {
  it("returns voided when voided", () => {
    expect(
      deriveNoSaleReason({
        reserveStatus: { kind: "met", hasReserve: true },
        hadBids: true,
        voided: true,
      }),
    ).toBe("voided");
  });

  it("returns clerk_passed for clerk no sale", () => {
    expect(
      deriveNoSaleReason({
        reserveStatus: { kind: "below", hasReserve: true },
        hadBids: true,
        trigger: "clerk_no_sale",
      }),
    ).toBe("clerk_passed");
  });

  it("returns no_bids when no bids placed", () => {
    expect(
      deriveNoSaleReason({
        reserveStatus: { kind: "none" },
        hadBids: false,
      }),
    ).toBe("no_bids");
  });

  it("returns reserve_not_met when bids exist but below reserve", () => {
    expect(
      deriveNoSaleReason({
        reserveStatus: { kind: "below", hasReserve: true },
        hadBids: true,
        trigger: "timed",
      }),
    ).toBe("reserve_not_met");
  });

  it("returns clerk_passed when bids exist and reserve was met (only clerk can produce this)", () => {
    expect(
      deriveNoSaleReason({
        reserveStatus: { kind: "met", hasReserve: true },
        hadBids: true,
        trigger: "clerk_hammer",
      }),
    ).toBe("clerk_passed");
  });

  it("returns clerk_passed when bids exist and no reserve (no-reserve clerk pass)", () => {
    expect(
      deriveNoSaleReason({
        reserveStatus: { kind: "none" },
        hadBids: true,
        trigger: "clerk_hammer",
      }),
    ).toBe("clerk_passed");
  });
});
