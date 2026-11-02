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
      buyersPremium: null,
    });
  });

  it("reads a flat premium rate", () => {
    expect(
      parseLotBiddingView({ buyersPremium: { kind: "flat", rate: "0.25" } }).buyersPremium,
    ).toEqual({ kind: "flat", rate: "0.25" });
  });

  it("reads premium bands and drops malformed ones", () => {
    expect(
      parseLotBiddingView({
        buyersPremium: {
          kind: "banded",
          bands: [{ fromHammer: "0.00", rate: "0.25" }, { fromHammer: 5 }, "x"],
        },
      }).buyersPremium,
    ).toEqual({ kind: "banded", bands: [{ fromHammer: "0.00", rate: "0.25" }] });
  });

  it("has no premium terms when they are missing or malformed", () => {
    expect(parseLotBiddingView({ buyersPremium: { kind: "flat" } }).buyersPremium).toBeNull();
    expect(
      parseLotBiddingView({ buyersPremium: { kind: "banded", bands: [] } }).buyersPremium,
    ).toBeNull();
    expect(parseLotBiddingView({ buyersPremium: "25%" }).buyersPremium).toBeNull();
  });

  it("keeps missing or malformed fields as null", () => {
    expect(parseLotBiddingView({ serverNow: "not a date", nextBidAmount: 5 })).toEqual(
      EMPTY_LOT_BIDDING_VIEW,
    );
    expect(parseLotBiddingView(null)).toEqual(EMPTY_LOT_BIDDING_VIEW);
  });
});
