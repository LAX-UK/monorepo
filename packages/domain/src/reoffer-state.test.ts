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

  it.each([
    "accepted",
    "declined",
    "expired",
    "seller_declined",
    "seller_lapsed",
    "withdrawn",
  ] as const)("%s is final", (status) => {
    expect(isFinalReofferStatus(status)).toBe(true);
    expect(allowedReofferEvents(status)).toEqual([]);
    expect(transitionReoffer(status, "withdrawn")).toEqual({ ok: false, reason: "final" });
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

describe("reofferProgress", () => {
  it("is none before any offer", () => {
    expect(reofferProgress([])).toEqual({ kind: "none" });
  });
  it("is open while one offer waits", () => {
    expect(reofferProgress(["declined", "offered"])).toEqual({ kind: "open" });
  });
  it("is re-offered once a bidder accepted", () => {
    expect(reofferProgress(["declined", "accepted"])).toEqual({ kind: "re_offered" });
  });
  it("asks staff to decide, allowing another offer below the limit", () => {
    expect(reofferProgress(["expired", "declined"])).toEqual({
      kind: "needs_decision",
      canOfferAgain: true,
    });
  });
  it("allows no fourth offer", () => {
    expect(reofferProgress(["expired", "declined", "seller_declined"])).toEqual({
      kind: "needs_decision",
      canOfferAgain: false,
    });
  });
});
