import { describe, expect, it } from "vitest";
import { amountRefusal, isBiddingClosedStatus, typedPlaceBidRefusal } from "./place-bid-refusal.js";

const english = {
  auctionType: "english",
  currentPrice: "100.00",
  startingPrice: "50.00",
  minBidIncrement: "10.00",
} as const;

describe("amountRefusal", () => {
  it("tells a bidder who confirmed against an older next bid that they were outbid", () => {
    expect(amountRefusal({ lot: english, seenNextBid: "100.00" })).toEqual({
      code: "outbid_during_confirm",
      details: { nextBidAmount: "110.00" },
    });
  });

  it("names the nearest valid amount when the amount is simply too low", () => {
    expect(amountRefusal({ lot: english })).toEqual({
      code: "amount_invalid",
      details: { nearestValidAmount: "110.00" },
    });
  });

  it("does not call it outbid when the bidder saw the current next bid", () => {
    expect(amountRefusal({ lot: english, seenNextBid: "110.00" }).code).toBe("amount_invalid");
  });

  it("uses the starting price for a sealed lot", () => {
    expect(amountRefusal({ lot: { ...english, auctionType: "sealed" } }).details).toEqual({
      nearestValidAmount: "50.00",
    });
  });
});

describe("typedPlaceBidRefusal", () => {
  it("types the registration refusals", () => {
    expect(typedPlaceBidRefusal("sale_registration_required", undefined)?.code).toBe(
      "registration_required",
    );
    expect(typedPlaceBidRefusal("sale_registration_pending", undefined)?.code).toBe(
      "registration_pending",
    );
  });

  it("types every limit refusal as over_limit with the room left", () => {
    for (const code of [
      "bid_limit_exceeded",
      "authorisation_total_limit_exceeded",
      "organisation_limit_exceeded",
    ]) {
      expect(typedPlaceBidRefusal(code, { limit: "500.00", available: "120.00" })).toEqual({
        code: "over_limit",
        details: { limit: "500.00", available: "120.00", remaining: "120.00" },
      });
    }
  });

  it("leaves other codes alone", () => {
    expect(typedPlaceBidRefusal("already_leading", undefined)).toBeNull();
    expect(typedPlaceBidRefusal(undefined, undefined)).toBeNull();
  });
});

describe("isBiddingClosedStatus", () => {
  it("closes ended, cancelled and voided lots only", () => {
    expect(["ended", "cancelled", "voided"].every(isBiddingClosedStatus)).toBe(true);
    expect(isBiddingClosedStatus("scheduled")).toBe(false);
    expect(isBiddingClosedStatus("active")).toBe(false);
  });
});
