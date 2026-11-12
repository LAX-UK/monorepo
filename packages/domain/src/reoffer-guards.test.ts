import { describe, expect, it } from "vitest";
import { reofferResponseBlock, reofferSendBlock } from "./reoffer-guards.js";

const base = {
  lot: { status: "ended" as const, winnerId: null },
  latestDefaultId: "d1",
  offerDefaultId: "d1",
  payments: [],
  otherOffers: [],
};

describe("reofferSendBlock", () => {
  it("allows a send for the lot's latest default with nothing paid", () => {
    expect(reofferSendBlock(base)).toBeNull();
  });

  it("refuses once the lot defaulted again", () => {
    expect(reofferSendBlock({ ...base, latestDefaultId: "d2" })?.code).toBe("offer_superseded");
    expect(reofferSendBlock({ ...base, latestDefaultId: null })?.code).toBe("offer_superseded");
  });

  it("refuses a lot that is not waiting for a buyer", () => {
    expect(reofferSendBlock({ ...base, lot: { status: "active", winnerId: null } })?.code).toBe(
      "lot_not_reawardable",
    );
  });

  it("refuses a lot that has a buyer again", () => {
    expect(reofferSendBlock({ ...base, lot: { status: "ended", winnerId: "u" } })?.code).toBe(
      "lot_has_buyer",
    );
  });

  it.each(["captured", "authorized", "requires_manual_review"] as const)(
    "refuses a lot with a %s payment",
    (status) => {
      expect(reofferSendBlock({ ...base, payments: [{ status }] })?.code).toBe(
        "payment_in_progress",
      );
    },
  );

  it("refuses when another offer of the default was accepted", () => {
    const other = [{ status: "accepted" as const, offerSentAt: new Date() }];
    expect(reofferSendBlock({ ...base, otherOffers: other })?.code).toBe("already_re_offered");
  });
});

describe("reofferResponseBlock", () => {
  const ends = new Date("2026-11-14T17:00:00Z");
  it("allows an answer before the end", () => {
    expect(
      reofferResponseBlock(
        { status: "offered", offerEndsAt: ends },
        new Date("2026-11-14T16:59:59Z"),
      ),
    ).toBeNull();
  });
  it("refuses at and after the end, even before the clock has closed the offer", () => {
    expect(reofferResponseBlock({ status: "offered", offerEndsAt: ends }, ends)?.code).toBe(
      "offer_window_ended",
    );
  });
  it.each(["ready", "accepted", "declined", "expired", "withdrawn", "awaiting_seller"] as const)(
    "refuses an offer that is %s",
    (status) => {
      expect(
        reofferResponseBlock({ status, offerEndsAt: ends }, new Date("2026-11-13T10:00:00Z"))?.code,
      ).toBe("offer_not_open");
    },
  );
});
