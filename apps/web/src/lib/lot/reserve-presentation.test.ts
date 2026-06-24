import { describe, expect, it } from "vitest";
import {
  leadingBelowReserve,
  reserveBadgeLabel,
  resolveEndedBanner,
  resolveLotReserveContext,
} from "./reserve-presentation.js";

describe("resolveLotReserveContext", () => {
  it("uses public API fields when reserve amount is withheld", () => {
    const ctx = resolveLotReserveContext(
      {
        hasReserve: true,
        reserveMet: false,
      } as never,
      "1101.00",
    );
    expect(ctx).toEqual({ hasReserve: true, reserveMet: false });
  });

  it("derives from reserve price for staff lots", () => {
    const ctx = resolveLotReserveContext({ reservePrice: "27000.00" } as never, "1101.00");
    expect(ctx).toEqual({ hasReserve: true, reserveMet: false });
  });
});

describe("reserveBadgeLabel", () => {
  it("returns Below reserve when not met", () => {
    expect(reserveBadgeLabel(false, true)).toBe("Below reserve");
  });
});

describe("resolveEndedBanner", () => {
  it("distinguishes clerk pass from reserve not met", () => {
    expect(resolveEndedBanner({ noSaleReason: "clerk_passed" })).toBe(
      "This lot was passed — no sale.",
    );
    expect(resolveEndedBanner({ noSaleReason: "no_bids" })).toBe("This lot closed with no bids.");
  });

  it("tailors high bidder copy", () => {
    expect(resolveEndedBanner({ noSaleReason: "reserve_not_met", isHighBidder: true })).toContain(
      "high bid",
    );
  });
});

describe("leadingBelowReserve", () => {
  it("is true when leading with reserve not met", () => {
    expect(leadingBelowReserve({ hasReserve: true, reserveMet: false }, true)).toBe(true);
    expect(leadingBelowReserve({ hasReserve: true, reserveMet: true }, true)).toBe(false);
  });
});
