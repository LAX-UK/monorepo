import { paymentStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import { paymentIsPaidOrBeingPaid } from "./buyer-default.js";
import { type ReofferStartFacts, reawardBlock, reofferStartBlock } from "./reoffer-eligibility.js";
import {
  type ReofferRecord,
  type ReofferStatus,
  canReopenLapsedRequest,
  transitionReoffer,
} from "./reoffer-state.js";

const startable: ReofferStartFacts = {
  soldOnAtg: false,
  buyerDefaultRecorded: true,
  payments: [{ status: "cancelled" }],
  offers: [],
};

const SENT = new Date("2026-11-10T10:00:00Z");
const rec = (status: ReofferStatus, sent = false): ReofferRecord => ({
  status,
  offerSentAt: sent ? SENT : null,
});

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
    expect(reofferStartBlock({ ...startable, offers: [rec("offered", true)] })?.code).toBe(
      "open_offer_exists",
    );
    expect(reofferStartBlock({ ...startable, offers: [rec("awaiting_seller", false)] })?.code).toBe(
      "open_offer_exists",
    );
  });

  it("stops once a bidder has accepted", () => {
    expect(
      reofferStartBlock({ ...startable, offers: [rec("declined", true), rec("accepted", true)] })
        ?.code,
    ).toBe("already_re_offered");
  });

  it("stops after three offers reached bidders", () => {
    const two = [rec("declined", true), rec("expired", true)];
    expect(reofferStartBlock({ ...startable, offers: two })).toBeNull();
    expect(reofferStartBlock({ ...startable, offers: [...two, rec("declined", true)] })?.code).toBe(
      "offer_limit_reached",
    );
  });

  it("does not count offers that never reached a bidder toward the limit", () => {
    const never = [
      rec("seller_lapsed", false),
      rec("withdrawn", false),
      rec("declined", true),
      rec("expired", true),
    ];
    expect(reofferStartBlock({ ...startable, offers: never })).toBeNull();
  });

  it("offers nothing more after the seller declined", () => {
    expect(
      reofferStartBlock({
        ...startable,
        offers: [rec("declined", true), rec("seller_declined", false)],
      })?.code,
    ).toBe("seller_declined_last_offer");
  });
});

describe("reawardBlock", () => {
  it.each(paymentStatuses)("a lot whose only payment is %s", (status) => {
    expect(reawardBlock({ payments: [{ status }], otherOffers: [] })?.code ?? null).toBe(
      PAID_OR_BEING_PAID.includes(status) ? "payment_in_progress" : null,
    );
  });

  it("blocks when any payment on the lot is paid, in any order", () => {
    expect(
      reawardBlock({ payments: [{ status: "cancelled" }, { status: "captured" }], otherOffers: [] })
        ?.code,
    ).toBe("payment_in_progress");
    expect(
      reawardBlock({ payments: [{ status: "captured" }, { status: "cancelled" }], otherOffers: [] })
        ?.code,
    ).toBe("payment_in_progress");
  });

  it("allows a lot with no payments or only unpaid ones", () => {
    expect(reawardBlock({ payments: [], otherOffers: [] })).toBeNull();
    expect(
      reawardBlock({
        payments: [{ status: "cancelled" }, { status: "pending" }],
        otherOffers: [rec("declined", true)],
      }),
    ).toBeNull();
  });
});

describe("a lapsed request and a second offer", () => {
  it("cannot award the lot through two offers", () => {
    // Offer 1 lapses; offer 2 goes to the same bidder and is accepted.
    const offers = [rec("seller_lapsed"), rec("accepted", true)];
    // The late answer on offer 1 can no longer reopen it...
    expect(canReopenLapsedRequest(offers)).toBe(false);
    // ...and even if it were sent, accepting it is refused while another offer is accepted.
    expect(
      reawardBlock({ payments: [{ status: "pending" }], otherOffers: [offers[1] as ReofferRecord] })
        ?.code,
    ).toBe("already_re_offered");
  });

  it("offers nothing new after a lapse: staff record the late answer or return the lot", () => {
    const offers = [rec("seller_lapsed")];
    expect(reofferStartBlock({ ...startable, offers })?.code).toBe("seller_declined_last_offer");
    expect(canReopenLapsedRequest(offers)).toBe(true);
    expect(transitionReoffer("seller_lapsed", "seller_agreed", "staff")).toEqual({
      ok: true,
      status: "ready",
    });
  });

  it("does not offer again to a bidder whose sent offer was withdrawn", () => {
    const offers = [rec("withdrawn", true), rec("withdrawn", true), rec("expired", true)];
    expect(reofferStartBlock({ ...startable, offers })?.code).toBe("offer_limit_reached");
    expect(reofferStartBlock({ ...startable, offers: [rec("withdrawn", true)] })).toBeNull();
  });
});
