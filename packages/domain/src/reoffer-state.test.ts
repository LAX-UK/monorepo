import { describe, expect, it } from "vitest";
import {
  REOFFER_EVENTS,
  REOFFER_STATUSES,
  type ReofferEvent,
  type ReofferStatus,
  allowedReofferEvents,
  endedWithoutSale,
  isFinalReofferStatus,
  isOpenReofferStatus,
  offerReachedBidder,
  offersCountedTowardCap,
  reofferProgress,
  transitionReoffer,
} from "./reoffer-state.js";

const ALLOWED: [ReofferStatus, ReofferEvent, ReofferStatus][] = [
  ["awaiting_seller", "seller_agreed", "ready"],
  ["awaiting_seller", "seller_declined", "seller_declined"],
  ["awaiting_seller", "seller_lapsed", "seller_lapsed"],
  ["awaiting_seller", "withdrawn", "withdrawn"],
  ["ready", "offer_sent", "offered"],
  ["ready", "withdrawn", "withdrawn"],
  ["offered", "bidder_accepted", "accepted"],
  ["offered", "bidder_declined", "declined"],
  ["offered", "offer_ended", "expired"],
  ["offered", "withdrawn", "withdrawn"],
];

describe("transitionReoffer", () => {
  it.each(ALLOWED)("%s + %s -> %s", (from, event, to) => {
    expect(transitionReoffer(from, event)).toEqual({ ok: true, status: to });
  });

  it("refuses every move that is not in the table", () => {
    const allowed = new Set(ALLOWED.map(([from, event]) => `${from}/${event}`));
    for (const from of REOFFER_STATUSES) {
      for (const event of REOFFER_EVENTS) {
        if (allowed.has(`${from}/${event}`)) continue;
        expect(transitionReoffer(from, event).ok).toBe(false);
      }
    }
  });

  it("cannot skip the seller's agreement or accept before the offer is sent", () => {
    expect(transitionReoffer("awaiting_seller", "offer_sent")).toEqual({
      ok: false,
      reason: "not_allowed",
    });
    expect(transitionReoffer("ready", "bidder_accepted")).toEqual({
      ok: false,
      reason: "not_allowed",
    });
  });

  it.each(["accepted", "declined", "expired", "seller_declined", "withdrawn"] as const)(
    "%s is final",
    (status) => {
      expect(isFinalReofferStatus(status)).toBe(true);
      expect(allowedReofferEvents(status)).toEqual([]);
      expect(transitionReoffer(status, "withdrawn")).toEqual({ ok: false, reason: "final" });
    },
  );

  it("lets only staff reopen a lapsed request, by recording the seller's answer", () => {
    expect(isFinalReofferStatus("seller_lapsed")).toBe(false);
    expect(transitionReoffer("seller_lapsed", "seller_agreed", "staff")).toEqual({
      ok: true,
      status: "ready",
    });
    expect(transitionReoffer("seller_lapsed", "seller_declined", "staff")).toEqual({
      ok: true,
      status: "seller_declined",
    });
    for (const actor of ["seller", "bidder", "clock"] as const) {
      expect(transitionReoffer("seller_lapsed", "seller_agreed", actor).ok).toBe(false);
    }
    expect(transitionReoffer("seller_lapsed", "offer_sent", "staff").ok).toBe(false);
    expect(allowedReofferEvents("seller_lapsed")).toEqual([]);
    expect(allowedReofferEvents("seller_lapsed", "staff")).toEqual([
      "seller_agreed",
      "seller_declined",
    ]);
  });

  it("lists what an open offer accepts", () => {
    expect(allowedReofferEvents("offered")).toEqual([
      "bidder_accepted",
      "bidder_declined",
      "offer_ended",
      "withdrawn",
    ]);
  });

  it("treats only the waiting statuses as open", () => {
    expect(REOFFER_STATUSES.filter(isOpenReofferStatus)).toEqual([
      "awaiting_seller",
      "ready",
      "offered",
    ]);
  });

  it("marks every final status except accepted as ended without a sale", () => {
    expect(REOFFER_STATUSES.filter(endedWithoutSale)).toEqual([
      "declined",
      "expired",
      "seller_declined",
      "seller_lapsed",
      "withdrawn",
    ]);
  });
});

describe("offers counted toward the cap", () => {
  it("counts only offers that reached a bidder", () => {
    for (const status of ["offered", "accepted", "declined", "expired"] as const) {
      expect(offerReachedBidder({ status })).toBe(true);
    }
    for (const status of [
      "awaiting_seller",
      "ready",
      "seller_declined",
      "seller_lapsed",
    ] as const) {
      expect(offerReachedBidder({ status })).toBe(false);
    }
  });

  it("counts a withdrawn offer only when it was sent first", () => {
    expect(offerReachedBidder({ status: "withdrawn" })).toBe(false);
    expect(offerReachedBidder({ status: "withdrawn", sentToBidder: false })).toBe(false);
    expect(offerReachedBidder({ status: "withdrawn", sentToBidder: true })).toBe(true);
  });

  it("is the number that reached a bidder", () => {
    expect(
      offersCountedTowardCap([
        { status: "seller_declined" },
        { status: "seller_lapsed" },
        { status: "withdrawn" },
        { status: "declined" },
        { status: "withdrawn", sentToBidder: true },
      ]),
    ).toBe(2);
  });
});

describe("reofferProgress", () => {
  const records = (...statuses: ReofferStatus[]) => statuses.map((status) => ({ status }));

  it("is none before any offer", () => {
    expect(reofferProgress([])).toEqual({ kind: "none" });
  });
  it("is open while one offer waits", () => {
    expect(reofferProgress(records("declined", "offered"))).toEqual({ kind: "open" });
  });
  it("is re-offered once a bidder accepted", () => {
    expect(reofferProgress(records("declined", "accepted"))).toEqual({ kind: "re_offered" });
  });
  it("asks staff to decide, allowing another offer below the limit", () => {
    expect(reofferProgress(records("expired", "declined"))).toEqual({
      kind: "needs_decision",
      canOfferAgain: true,
    });
  });
  it("allows no fourth offer", () => {
    expect(reofferProgress(records("expired", "declined", "expired"))).toEqual({
      kind: "needs_decision",
      canOfferAgain: false,
    });
  });
  it("does not count offers the seller refused or let lapse toward the limit", () => {
    expect(
      reofferProgress(records("declined", "seller_lapsed", "expired", "seller_lapsed")),
    ).toEqual({ kind: "needs_decision", canOfferAgain: true });
  });
  it("offers no further bidder after the seller declined", () => {
    expect(reofferProgress(records("declined", "seller_declined"))).toEqual({
      kind: "needs_decision",
      canOfferAgain: false,
    });
  });
});
