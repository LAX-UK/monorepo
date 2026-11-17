import { describe, expect, it } from "vitest";
import { staffBidLimitRefusalFrom } from "./staff-bid-limit-refusal.js";

describe("staffBidLimitRefusalFrom", () => {
  it("reads a paddle's limit, which shares its code with a buyer agent's per-lot limit", () => {
    expect(
      staffBidLimitRefusalFrom("bid_limit_exceeded", { limitKind: "paddle", limit: "5000.00" }),
    ).toEqual({ kind: "paddle", limit: "5000.00", available: null });
  });

  it("reads a telephone booking's maximum", () => {
    expect(
      staffBidLimitRefusalFrom("authorized_max_exceeded", {
        limitKind: "telephone",
        limit: "8000.00",
      }),
    ).toEqual({ kind: "telephone", limit: "8000.00", available: null });
  });

  it("reads a sale registration's approved limit, which also shares the per-lot code", () => {
    expect(
      staffBidLimitRefusalFrom("bid_limit_exceeded", {
        limitKind: "registration",
        limit: "5000.00",
        available: "5000.00",
      }),
    ).toEqual({ kind: "registration", limit: "5000.00", available: null });
  });

  it("gives staff only the room left on this lot for the organisation's own limit", () => {
    const refusal = staffBidLimitRefusalFrom("organisation_limit_exceeded", {
      limitKind: "organisation",
      limit: "50000.00",
      available: "2000.00",
    });
    expect(refusal).toEqual({ kind: "organisation", limit: null, available: "2000.00" });
    expect(JSON.stringify(refusal)).not.toContain("50000");
    expect(
      staffBidLimitRefusalFrom("organisation_limit_exceeded", {
        limitKind: "organisation",
        limit: "50000.00",
        available: "lots",
      }),
    ).toBeNull();
    expect(
      staffBidLimitRefusalFrom("bid_limit_exceeded", {
        limitKind: "per_lot",
        limit: "20000.00",
        available: "20000.00",
      })?.kind,
    ).toBe("per_lot");
  });

  it("gives staff only the room left on this lot for a buyer agent's total authorisation", () => {
    // £30,000 in total, £28,500 committed on other lots: the clerk must learn neither.
    const refusal = staffBidLimitRefusalFrom("authorisation_total_limit_exceeded", {
      limitKind: "authorisation_total",
      limit: "30000.00",
      available: "1500.00",
    });
    expect(refusal).toEqual({ kind: "authorisation_total", limit: null, available: "1500.00" });
    expect(JSON.stringify(refusal)).not.toContain("30000");
    expect(
      staffBidLimitRefusalFrom("authorisation_total_limit_exceeded", {
        limitKind: "authorisation_total",
        limit: "30000.00",
        available: "some",
      }),
    ).toBeNull();
  });

  it("never passes on the total of any limit shared across lots", () => {
    for (const [code, kind] of [
      ["organisation_limit_exceeded", "organisation"],
      ["authorisation_total_limit_exceeded", "authorisation_total"],
    ] as const) {
      const refusal = staffBidLimitRefusalFrom(code, {
        limitKind: kind,
        limit: "98765.43",
        available: "0.00",
      });
      expect(refusal?.kind).toBe(kind);
      expect(refusal?.limit).toBeNull();
      expect(JSON.stringify(refusal)).not.toContain("98765");
    }
  });

  it("is null for other refusals, a mismatched code, or without a limit to show", () => {
    expect(staffBidLimitRefusalFrom("lot_closed", { limit: "1.00" })).toBeNull();
    expect(staffBidLimitRefusalFrom("bid_limit_exceeded", undefined)).toBeNull();
    expect(
      staffBidLimitRefusalFrom("authorized_max_exceeded", {
        limitKind: "registration",
        limit: "1000.00",
        available: "1000.00",
      }),
    ).toBeNull();
    expect(
      staffBidLimitRefusalFrom("authorized_max_exceeded", {
        limitKind: "telephone",
        limit: "lots",
      }),
    ).toBeNull();
    expect(
      staffBidLimitRefusalFrom("authorized_max_exceeded", { limitKind: "paddle", limit: "1.00" }),
    ).toBeNull();
  });
});
