import { describe, expect, it } from "vitest";
import {
  type BidderAccountState,
  type PlacedBid,
  selectNextBidder,
} from "./reoffer-next-bidder.js";

let clock = 0;
function bid(
  userId: string,
  legalEntityId: string,
  amountMinor: number,
  accountState: BidderAccountState = "active",
): PlacedBid {
  clock += 1;
  return {
    userId,
    legalEntityId,
    amountMinor,
    accountState,
    placedAt: new Date(2026, 0, 1, 0, clock),
  };
}

const buyer = { userId: "u-buyer", legalEntityId: "e-buyer" };

describe("selectNextBidder", () => {
  it("offers the highest bid from someone else, at that bid", () => {
    const result = selectNextBidder({
      bids: [bid("u-buyer", "e-buyer", 900), bid("u2", "e2", 800), bid("u3", "e3", 700)],
      defaultingBuyer: buyer,
      alreadyOffered: [],
    });
    expect(result).toEqual({
      kind: "found",
      bidder: { userId: "u2", legalEntityId: "e2", amountMinor: 800 },
      skipped: [],
    });
  });

  it("uses a bidder's highest placed bid, not an earlier lower one", () => {
    const result = selectNextBidder({
      bids: [bid("u2", "e2", 500), bid("u2", "e2", 800), bid("u3", "e3", 700)],
      defaultingBuyer: buyer,
      alreadyOffered: [],
    });
    expect(result).toMatchObject({ kind: "found", bidder: { userId: "u2", amountMinor: 800 } });
  });

  it("counts the buyer's other account as the same buyer", () => {
    const result = selectNextBidder({
      bids: [bid("u-buyer", "e-company", 850), bid("u2", "e2", 800)],
      defaultingBuyer: buyer,
      alreadyOffered: [],
    });
    expect(result).toMatchObject({ kind: "found", bidder: { userId: "u2" } });
  });

  it("counts another person bidding for the buyer's account as the same buyer", () => {
    const result = selectNextBidder({
      bids: [bid("u-agent", "e-buyer", 850), bid("u2", "e2", 800)],
      defaultingBuyer: buyer,
      alreadyOffered: [],
    });
    expect(result).toMatchObject({ kind: "found", bidder: { userId: "u2" } });
  });

  it("reports no other bidder when only the buyer bid", () => {
    expect(
      selectNextBidder({
        bids: [bid("u-buyer", "e-buyer", 900)],
        defaultingBuyer: buyer,
        alreadyOffered: [],
      }),
    ).toEqual({ kind: "none", reason: "no_other_bidder", skipped: [] });
    expect(selectNextBidder({ bids: [], defaultingBuyer: buyer, alreadyOffered: [] }).kind).toBe(
      "none",
    );
  });

  it.each(["suspended", "closed", "deletion_pending"] as const)(
    "skips a %s account and records why",
    (state) => {
      const result = selectNextBidder({
        bids: [bid("u2", "e2", 800, state), bid("u3", "e3", 700)],
        defaultingBuyer: buyer,
        alreadyOffered: [],
      });
      expect(result).toEqual({
        kind: "found",
        bidder: { userId: "u3", legalEntityId: "e3", amountMinor: 700 },
        skipped: [{ userId: "u2", legalEntityId: "e2", amountMinor: 800, reason: state }],
      });
    },
  );

  it("leaves out bidders already offered, and their lower bids, without a record", () => {
    const result = selectNextBidder({
      bids: [bid("u2", "e2", 800), bid("u2", "e2", 600), bid("u3", "e3", 700)],
      defaultingBuyer: buyer,
      alreadyOffered: [{ userId: "u2", legalEntityId: "e2", status: "declined" }],
    });
    expect(result).toEqual({
      kind: "found",
      bidder: { userId: "u3", legalEntityId: "e3", amountMinor: 700 },
      skipped: [],
    });
  });

  it("offers the next bidder their own bid, never the earlier bidder's", () => {
    const result = selectNextBidder({
      bids: [bid("u2", "e2", 800), bid("u3", "e3", 700)],
      defaultingBuyer: buyer,
      alreadyOffered: [{ userId: "u2", legalEntityId: "e2", status: "declined" }],
    });
    expect(result).toMatchObject({ kind: "found", bidder: { userId: "u3", amountMinor: 700 } });
  });

  it("reports when nobody is eligible, with every skip once", () => {
    const result = selectNextBidder({
      bids: [
        bid("u2", "e2", 800, "suspended"),
        bid("u2", "e2", 700, "suspended"),
        bid("u3", "e3", 600, "closed"),
      ],
      defaultingBuyer: buyer,
      alreadyOffered: [],
    });
    expect(result).toEqual({
      kind: "none",
      reason: "no_eligible_bidder",
      skipped: [
        { userId: "u2", legalEntityId: "e2", amountMinor: 800, reason: "suspended" },
        { userId: "u3", legalEntityId: "e3", amountMinor: 600, reason: "closed" },
      ],
    });
  });

  it("breaks a tie in favour of the earlier bid", () => {
    const first = bid("u2", "e2", 800);
    const later = bid("u3", "e3", 800);
    expect(
      selectNextBidder({ bids: [later, first], defaultingBuyer: buyer, alreadyOffered: [] }),
    ).toMatchObject({ kind: "found", bidder: { userId: "u2" } });
  });

  it("makes no fourth offer", () => {
    const offered = ["a", "b", "c"].map((id) => ({
      userId: `u-${id}`,
      legalEntityId: `e-${id}`,
      status: "declined" as const,
    }));
    expect(
      selectNextBidder({
        bids: [bid("u9", "e9", 100)],
        defaultingBuyer: buyer,
        alreadyOffered: offered,
      }),
    ).toEqual({ kind: "none", reason: "offer_limit_reached", skipped: [] });
  });

  it("counts only offers that reached a bidder toward the limit and as already offered", () => {
    const prior = [
      { userId: "u-a", legalEntityId: "e-a", status: "seller_declined" as const },
      { userId: "u-b", legalEntityId: "e-b", status: "seller_lapsed" as const },
      { userId: "u-c", legalEntityId: "e-c", status: "withdrawn" as const },
      { userId: "u-d", legalEntityId: "e-d", status: "declined" as const },
    ];
    const bids = [bid("u-a", "e-a", 800), bid("u-d", "e-d", 700), bid("u9", "e9", 100)];
    // The seller's refusal never reached u-a, so u-a is still next in line; u-d was offered.
    expect(selectNextBidder({ bids, defaultingBuyer: buyer, alreadyOffered: prior })).toMatchObject(
      { kind: "found", bidder: { userId: "u-a", amountMinor: 800 } },
    );
    expect(
      selectNextBidder({
        bids: [bid("u-d", "e-d", 700)],
        defaultingBuyer: buyer,
        alreadyOffered: prior,
      }),
    ).toMatchObject({ kind: "none", reason: "no_other_bidder" });
  });

  it("collapses a person's lower bid under another account into their highest", () => {
    const result = selectNextBidder({
      bids: [bid("u2", "e2", 800, "suspended"), bid("u2", "e2-company", 600), bid("u3", "e3", 500)],
      defaultingBuyer: buyer,
      alreadyOffered: [],
    });
    expect(result).toMatchObject({
      kind: "found",
      bidder: { userId: "u3" },
      skipped: [{ userId: "u2", reason: "suspended" }],
    });
  });

  it("does not change the bids it is given", () => {
    const bids = [bid("u3", "e3", 700), bid("u2", "e2", 800)];
    const copy = [...bids];
    selectNextBidder({ bids, defaultingBuyer: buyer, alreadyOffered: [] });
    expect(bids).toEqual(copy);
  });
});
