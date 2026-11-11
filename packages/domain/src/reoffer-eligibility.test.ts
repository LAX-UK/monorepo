import type { PaymentStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import { type ReofferStartFacts, reawardBlock, reofferStartBlock } from "./reoffer-eligibility.js";

const startable: ReofferStartFacts = {
  soldOnAtg: false,
  buyerDefaultRecorded: true,
  payment: { status: "cancelled" },
  openOfferCount: 0,
  offersMadeCount: 0,
};

describe("reofferStartBlock", () => {
  it("allows a re-offer after a recorded default with a cancelled invoice", () => {
    expect(reofferStartBlock(startable)).toBeNull();
    expect(reofferStartBlock({ ...startable, payment: null })).toBeNull();
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

  it.each(["authorized", "captured", "refunded"] as PaymentStatus[])(
    "never re-awards a lot whose payment is %s",
    (status) => {
      expect(reofferStartBlock({ ...startable, payment: { status } })?.code).toBe(
        "payment_in_progress",
      );
    },
  );

  it("allows one offer at a time", () => {
    expect(reofferStartBlock({ ...startable, openOfferCount: 1, offersMadeCount: 1 })?.code).toBe(
      "open_offer_exists",
    );
  });

  it("stops after three offers", () => {
    expect(reofferStartBlock({ ...startable, offersMadeCount: 2 })).toBeNull();
    expect(reofferStartBlock({ ...startable, offersMadeCount: 3 })?.code).toBe(
      "offer_limit_reached",
    );
  });
});

describe("reawardBlock", () => {
  it("blocks a paid or being-paid lot and allows the rest", () => {
    expect(reawardBlock({ status: "captured" })?.code).toBe("payment_in_progress");
    expect(reawardBlock({ status: "authorized" })?.code).toBe("payment_in_progress");
    expect(reawardBlock({ status: "pending" })).toBeNull();
    expect(reawardBlock({ status: "cancelled" })).toBeNull();
    expect(reawardBlock(null)).toBeNull();
  });
});
