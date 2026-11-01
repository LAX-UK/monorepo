import { describe, expect, it } from "vitest";
import { EMPTY_LOT_BIDDING_VIEW, parseLotBiddingView } from "./lot-bidding-view";

describe("parseLotBiddingView", () => {
  it("reads the server clock, next bid and sold prices", () => {
    expect(
      parseLotBiddingView({
        serverNow: "2026-11-03T20:00:00.000Z",
        nextBidAmount: "7250.00",
        hammerPrice: "7000.00",
        soldForWithPremium: "8750.00",
        title: "ignored",
      }),
    ).toEqual({
      serverNow: "2026-11-03T20:00:00.000Z",
      nextBidAmount: "7250.00",
      hammerPrice: "7000.00",
      soldForWithPremium: "8750.00",
    });
  });

  it("keeps missing or malformed fields as null", () => {
    expect(parseLotBiddingView({ serverNow: "not a date", nextBidAmount: 5 })).toEqual(
      EMPTY_LOT_BIDDING_VIEW,
    );
    expect(parseLotBiddingView(null)).toEqual(EMPTY_LOT_BIDDING_VIEW);
  });
});
