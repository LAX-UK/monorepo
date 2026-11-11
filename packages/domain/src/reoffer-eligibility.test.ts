import { paymentStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import { paymentIsPaidOrBeingPaid } from "./buyer-default.js";
import { type ReofferStartFacts, reawardBlock, reofferStartBlock } from "./reoffer-eligibility.js";

const startable: ReofferStartFacts = {
  soldOnAtg: false,
  buyerDefaultRecorded: true,
  payments: [{ status: "cancelled" }],
  offers: [],
};

const PAID_OR_BEING_PAID = ["authorized", "captured", "refunded", "requires_manual_review"];

describe("paymentIsPaidOrBeingPaid", () => {
  it.each(paymentStatuses)("%s", (status) => {
    expect(paymentIsPaidOrBeingPaid(status)).toBe(PAID_OR_BEING_PAID.includes(status));
  });
});

describe("reofferStartBlock", () => {
  it("allows a re-offer after a recorded default with a cancelled invoice", () => {
    expect(reofferStartBlock(startable)).toBeNull();
    expect(reofferStartBlock({ ...startable, payments: [] })).toBeNull();
  });

  it("excludes lots sold on ATG before anything else", () => {
    expect(
      reofferStartBlock({ ...startable, soldOnAtg: true, buyerDefaultRecorded: false })?.code,
    ).toBe("sold_on_atg");
  });

  it("needs a recorded default", () => {
    expect(reofferStartBlock({ ...startable, buyerDefaultRecorded: false })?.code).toBe(
      "buyer_default_not_recorded",
    );
  });

  it.each(paymentStatuses)("a lot whose only payment is %s", (status) => {
    const block = reofferStartBlock({ ...startable, payments: [{ status }] });
    expect(block?.code ?? null).toBe(
      PAID_OR_BEING_PAID.includes(status) ? "payment_in_progress" : null,
    );
  });

  it("is blocked when any one of several payments is paid", () => {
    expect(
      reofferStartBlock({
        ...startable,
        payments: [{ status: "cancelled" }, { status: "captured" }],
      })?.code,
    ).toBe("payment_in_progress");
  });

  it("allows one offer at a time", () => {
    expect(reofferStartBlock({ ...startable, offers: [{ status: "offered" }] })?.code).toBe(
      "open_offer_exists",
    );
    expect(reofferStartBlock({ ...startable, offers: [{ status: "awaiting_seller" }] })?.code).toBe(
      "open_offer_exists",
    );
  });

  it("stops once a bidder has accepted", () => {
    expect(
      reofferStartBlock({ ...startable, offers: [{ status: "declined" }, { status: "accepted" }] })
        ?.code,
    ).toBe("already_re_offered");
  });

  it("stops after three offers reached bidders", () => {
    const two = [{ status: "declined" as const }, { status: "expired" as const }];
    expect(reofferStartBlock({ ...startable, offers: two })).toBeNull();
    expect(
      reofferStartBlock({ ...startable, offers: [...two, { status: "declined" }] })?.code,
    ).toBe("offer_limit_reached");
  });

  it("does not count offers that never reached a bidder toward the limit", () => {
    const never = [
      { status: "seller_lapsed" as const },
      { status: "withdrawn" as const },
      { status: "declined" as const },
      { status: "expired" as const },
    ];
    expect(reofferStartBlock({ ...startable, offers: never })).toBeNull();
  });

  it("offers nothing more after the seller declined", () => {
    expect(
      reofferStartBlock({
        ...startable,
        offers: [{ status: "declined" }, { status: "seller_declined" }],
      })?.code,
    ).toBe("seller_declined_last_offer");
  });
});

describe("reawardBlock", () => {
  it.each(paymentStatuses)("a lot whose only payment is %s", (status) => {
    expect(reawardBlock([{ status }])?.code ?? null).toBe(
      PAID_OR_BEING_PAID.includes(status) ? "payment_in_progress" : null,
    );
  });

  it("blocks when any payment on the lot is paid, in any order", () => {
    expect(reawardBlock([{ status: "cancelled" }, { status: "captured" }])?.code).toBe(
      "payment_in_progress",
    );
    expect(reawardBlock([{ status: "captured" }, { status: "cancelled" }])?.code).toBe(
      "payment_in_progress",
    );
  });

  it("allows a lot with no payments or only unpaid ones", () => {
    expect(reawardBlock([])).toBeNull();
    expect(reawardBlock([{ status: "cancelled" }, { status: "pending" }])).toBeNull();
  });
});
