import { describe, expect, it } from "vitest";
import { pricedOnEarlierVersion } from "./agreement-version.js";

const pricedAt = new Date("2026-11-01T10:00:00Z");

describe("pricedOnEarlierVersion", () => {
  it("is false while the agreement still says what the sale was priced on", () => {
    expect(
      pricedOnEarlierVersion(
        { commissionBps: 1200, computedAt: pricedAt },
        { commissionPercent: "12.00", updatedAt: new Date("2026-10-30T10:00:00Z") },
      ),
    ).toBe(false);
  });

  it("is true once the commission on the row differs from the snapshot's rate", () => {
    expect(
      pricedOnEarlierVersion(
        { commissionBps: 1200, computedAt: pricedAt },
        { commissionPercent: "15.00", updatedAt: new Date("2026-10-30T10:00:00Z") },
      ),
    ).toBe(true);
  });

  it("is true when the row was written again after the sale was priced, even at the same rate", () => {
    expect(
      pricedOnEarlierVersion(
        { commissionBps: 1200, computedAt: pricedAt },
        { commissionPercent: "12.00", updatedAt: new Date("2026-11-02T10:00:00Z") },
      ),
    ).toBe(true);
  });

  it("is false for a snapshot with no rate (held or LAX's own)", () => {
    expect(
      pricedOnEarlierVersion(
        { commissionBps: null, computedAt: pricedAt },
        { commissionPercent: "15.00", updatedAt: new Date("2026-11-02T10:00:00Z") },
      ),
    ).toBe(false);
  });
});
