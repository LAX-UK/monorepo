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

  it("reads the organisation's limits with the room left", () => {
    expect(
      staffBidLimitRefusalFrom("organisation_limit_exceeded", {
        limitKind: "organisation",
        limit: "50000.00",
        available: "2000.00",
      }),
    ).toEqual({ kind: "organisation", limit: "50000.00", available: "2000.00" });
    expect(
      staffBidLimitRefusalFrom("bid_limit_exceeded", {
        limitKind: "per_lot",
        limit: "20000.00",
        available: "20000.00",
      })?.kind,
    ).toBe("per_lot");
  });

  it("is null for other refusals, a registration limit, or without a limit to show", () => {
    expect(staffBidLimitRefusalFrom("lot_closed", { limit: "1.00" })).toBeNull();
    expect(staffBidLimitRefusalFrom("bid_limit_exceeded", undefined)).toBeNull();
    expect(
      staffBidLimitRefusalFrom("bid_limit_exceeded", {
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
