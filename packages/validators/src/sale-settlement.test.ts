import { describe, expect, it } from "vitest";
import { isSaleSettled } from "./sale-settlement.js";

describe("isSaleSettled", () => {
  it("returns true when there are no sold lots", () => {
    const lots = [{ id: "l1", status: "ended", winnerId: null }];
    expect(isSaleSettled(lots, new Map())).toBe(true);
  });

  it("returns true when every sold lot has captured payment", () => {
    const lots = [{ id: "l1", status: "ended", winnerId: "u1" }];
    const payments = new Map([["l1", "captured"]]);
    expect(isSaleSettled(lots, payments)).toBe(true);
  });

  it("returns false when a sold lot lacks settled payment", () => {
    const lots = [{ id: "l1", status: "ended", winnerId: "u1" }];
    expect(isSaleSettled(lots, new Map())).toBe(false);
  });

  it("accepts refunded as settled", () => {
    const lots = [{ id: "l1", status: "ended", winnerId: "u1" }];
    const payments = new Map([["l1", "refunded"]]);
    expect(isSaleSettled(lots, payments)).toBe(true);
  });
});
