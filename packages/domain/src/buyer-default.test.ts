import { describe, expect, it } from "vitest";
import { type BuyerDefaultFacts, buyerDefaultBlock, pickUnderbidder } from "./buyer-default.js";

const owed: BuyerDefaultFacts = {
  lotStatus: "ended",
  winnerId: "buyer-1",
  payment: { status: "pending" },
  fulfilmentStatus: "awaiting_payment",
  hasOpenDispute: false,
};

describe("buyerDefaultBlock", () => {
  it("allows a won lot whose invoice is unpaid", () => {
    expect(buyerDefaultBlock(owed, "returned_to_inventory")).toBeNull();
  });

  it("allows a lot with an abandoned checkout or no invoice yet", () => {
    expect(
      buyerDefaultBlock({ ...owed, payment: { status: "cancelled" } }, "returned_to_inventory"),
    ).toBeNull();
    expect(
      buyerDefaultBlock(
        { ...owed, payment: null, fulfilmentStatus: null },
        "returned_to_inventory",
      ),
    ).toBeNull();
  });

  it("refuses a lot that has not ended or has no winner", () => {
    expect(buyerDefaultBlock({ ...owed, lotStatus: "active" }, "returned_to_inventory")?.code).toBe(
      "not_ended",
    );
    expect(buyerDefaultBlock({ ...owed, winnerId: null }, "returned_to_inventory")?.code).toBe(
      "no_winner",
    );
  });

  it.each(["authorized", "captured", "refunded"] as const)(
    "refuses a lot whose payment is %s",
    (status) => {
      expect(
        buyerDefaultBlock({ ...owed, payment: { status } }, "returned_to_inventory")?.code,
      ).toBe("payment_in_progress");
    },
  );

  it("refuses while LAX holds the payment for its own checks", () => {
    const block = buyerDefaultBlock(
      { ...owed, payment: { status: "requires_manual_review" } },
      "returned_to_inventory",
    );
    expect(block?.code).toBe("held_for_checks");
  });

  it("refuses an open dispute and a delivery already under way", () => {
    expect(
      buyerDefaultBlock({ ...owed, hasOpenDispute: true }, "returned_to_inventory")?.code,
    ).toBe("open_dispute");
    expect(
      buyerDefaultBlock({ ...owed, fulfilmentStatus: "in_transit" }, "returned_to_inventory")?.code,
    ).toBe("delivery_started");
  });

  it("refuses a lot already defaulted", () => {
    expect(
      buyerDefaultBlock({ ...owed, fulfilmentStatus: "cancelled" }, "returned_to_inventory")?.code,
    ).toBe("already_cancelled");
  });

  it("needs an underbidder to offer the lot on", () => {
    expect(buyerDefaultBlock(owed, "offered_to_underbidder")?.code).toBe("no_underbidder");
    expect(
      buyerDefaultBlock(
        { ...owed, underbidder: { userId: "u2", legalEntityId: "e2", amount: "900.00" } },
        "offered_to_underbidder",
      ),
    ).toBeNull();
  });
});

describe("pickUnderbidder", () => {
  const bids = [
    { userId: "buyer-1", legalEntityId: "e1", amount: "1000.00" },
    { userId: "u2", legalEntityId: "e2", amount: "900.00" },
    { userId: "u3", legalEntityId: "e3", amount: "950.00" },
    { userId: "buyer-1", legalEntityId: "e1", amount: "800.00" },
  ];

  it("is the highest bid from anyone other than the winner", () => {
    expect(pickUnderbidder(bids, "e1")).toEqual({
      userId: "u3",
      legalEntityId: "e3",
      amount: "950.00",
    });
  });

  it("is null when only the winner bid", () => {
    expect(pickUnderbidder([bids[0] as (typeof bids)[number]], "e1")).toBeNull();
    expect(pickUnderbidder([], "e1")).toBeNull();
  });

  it("compares amounts as numbers", () => {
    expect(
      pickUnderbidder(
        [
          { userId: "u2", legalEntityId: "e2", amount: "95.00" },
          { userId: "u3", legalEntityId: "e3", amount: "1000.00" },
        ],
        "e1",
      )?.userId,
    ).toBe("u3");
  });
});
