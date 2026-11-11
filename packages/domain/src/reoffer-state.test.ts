import { describe, expect, it } from "vitest";
import {
  BIDDER_REOFFER_STATUSES,
  REOFFER_EVENTS,
  REOFFER_STATUSES,
  type ReofferActor,
  type ReofferEvent,
  type ReofferRecord,
  type ReofferStatus,
  allowedReofferEvents,
  bidderReofferStatus,
  canReopenLapsedRequest,
  endedWithoutSale,
  isFinalReofferStatus,
  isOpenReofferStatus,
  offerReachedBidder,
  offersCountedTowardCap,
  reofferProgress,
  transitionReoffer,
} from "./reoffer-state.js";

const SENT = new Date("2026-11-10T10:00:00Z");
const rec = (status: ReofferStatus, sent = false): ReofferRecord => ({
  status,
  offerSentAt: sent ? SENT : null,
});
const ACTORS: ReofferActor[] = ["seller", "bidder", "staff", "clock"];

/** Every allowed move: status, event, the actors who may make it, the status it reaches. */
const ALLOWED: [ReofferStatus, ReofferEvent, ReofferActor[], ReofferStatus][] = [
  ["awaiting_seller", "seller_agreed", ["seller", "staff"], "ready"],
  ["awaiting_seller", "seller_declined", ["seller", "staff"], "seller_declined"],
  ["awaiting_seller", "seller_lapsed", ["clock"], "seller_lapsed"],
  ["awaiting_seller", "withdrawn", ["staff"], "withdrawn"],
  ["ready", "offer_sent", ["staff"], "offered"],
  ["ready", "withdrawn", ["staff"], "withdrawn"],
  ["offered", "bidder_accepted", ["bidder"], "accepted"],
  ["offered", "bidder_declined", ["bidder"], "declined"],
  ["offered", "offer_ended", ["clock"], "expired"],
  ["offered", "withdrawn", ["staff"], "withdrawn"],
  // A lapsed request can still be answered, by staff alone, recording what the seller said.
  ["seller_lapsed", "seller_agreed", ["staff"], "ready"],
  ["seller_lapsed", "seller_declined", ["staff"], "seller_declined"],
];

describe("transitionReoffer", () => {
  it("allows exactly the moves in the table, for exactly the listed actors", () => {
    for (const status of REOFFER_STATUSES) {
      for (const event of REOFFER_EVENTS) {
        for (const actor of ACTORS) {
          const row = ALLOWED.find(([s, e]) => s === status && e === event);
          const expected = row?.[2].includes(actor) ? { ok: true, status: row[3] } : { ok: false };
          expect(
            transitionReoffer(status, event, actor),
            `${status} ${event} ${actor}`,
          ).toMatchObject(expected);
        }
      }
    }
  });

  it("cannot skip the seller's agreement or accept before the offer is sent", () => {
    expect(transitionReoffer("awaiting_seller", "offer_sent", "staff")).toEqual({
      ok: false,
      reason: "not_allowed",
    });
    expect(transitionReoffer("ready", "bidder_accepted", "bidder")).toEqual({
      ok: false,
      reason: "not_allowed",
    });
  });

  it("does not let staff accept for a bidder or the seller lapse a request", () => {
    expect(transitionReoffer("offered", "bidder_accepted", "staff").ok).toBe(false);
    expect(transitionReoffer("awaiting_seller", "seller_lapsed", "staff").ok).toBe(false);
  });

  it.each(["accepted", "declined", "expired", "seller_declined", "withdrawn"] as const)(
    "%s is final",
    (status) => {
      expect(isFinalReofferStatus(status)).toBe(true);
      for (const actor of ACTORS) {
        expect(allowedReofferEvents(status, actor)).toEqual([]);
      }
      expect(transitionReoffer(status, "withdrawn", "staff")).toEqual({
        ok: false,
        reason: "final",
      });
    },
  );

  it("is not final for a lapsed request, which staff can still answer", () => {
    expect(isFinalReofferStatus("seller_lapsed")).toBe(false);
    expect(allowedReofferEvents("seller_lapsed", "seller")).toEqual([]);
    expect(allowedReofferEvents("seller_lapsed", "staff")).toEqual([
      "seller_agreed",
      "seller_declined",
    ]);
  });

  it("lists what an open offer accepts, by actor", () => {
    expect(allowedReofferEvents("offered", "bidder")).toEqual([
      "bidder_accepted",
      "bidder_declined",
    ]);
    expect(allowedReofferEvents("offered", "staff")).toEqual(["withdrawn"]);
    expect(allowedReofferEvents("offered", "clock")).toEqual(["offer_ended"]);
  });

  it("treats only the waiting statuses as open", () => {
    expect(REOFFER_STATUSES.filter(isOpenReofferStatus)).toEqual([
      "awaiting_seller",
      "ready",
      "offered",
    ]);
  });

  it("marks every closed status except accepted as ended without a sale", () => {
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
  it("reached the bidder when it was sent, whatever its status now", () => {
    expect(offerReachedBidder(rec("withdrawn", true))).toBe(true);
    expect(offerReachedBidder(rec("declined", true))).toBe(true);
    expect(offerReachedBidder(rec("withdrawn"))).toBe(false);
    expect(offerReachedBidder(rec("seller_declined"))).toBe(false);
    expect(offerReachedBidder(rec("seller_lapsed"))).toBe(false);
  });

  it("counts a withdrawn offer only when it was sent first", () => {
    expect(
      offersCountedTowardCap([
        rec("seller_declined"),
        rec("seller_lapsed"),
        rec("withdrawn"),
        rec("declined", true),
        rec("withdrawn", true),
      ]),
    ).toBe(2);
  });
});

describe("canReopenLapsedRequest", () => {
  it("only while the lapsed request is the latest offer", () => {
    expect(canReopenLapsedRequest([rec("declined", true), rec("seller_lapsed")])).toBe(true);
    expect(canReopenLapsedRequest([rec("seller_lapsed"), rec("offered", true)])).toBe(false);
    expect(canReopenLapsedRequest([rec("seller_lapsed"), rec("awaiting_seller")])).toBe(false);
    expect(canReopenLapsedRequest([rec("seller_declined")])).toBe(false);
    expect(canReopenLapsedRequest([])).toBe(false);
  });
});

describe("reofferProgress", () => {
  const records = (...statuses: ReofferStatus[]) => statuses.map((status) => rec(status, true));

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
  it("does not count offers that never reached a bidder toward the limit", () => {
    expect(
      reofferProgress([
        rec("declined", true),
        rec("withdrawn"),
        rec("expired", true),
        rec("withdrawn"),
      ]),
    ).toEqual({ kind: "needs_decision", canOfferAgain: true });
  });
  it.each(["seller_declined", "seller_lapsed"] as const)(
    "offers no further bidder after %s",
    (status) => {
      expect(reofferProgress([rec("declined", true), rec(status)])).toEqual({
        kind: "needs_decision",
        canOfferAgain: false,
      });
    },
  );
});

describe("bidderReofferStatus", () => {
  it("maps the offer to what the bidder sees", () => {
    expect(bidderReofferStatus(rec("offered", true))).toBe("offered");
    expect(bidderReofferStatus(rec("accepted", true))).toBe("accepted");
    expect(bidderReofferStatus(rec("declined", true))).toBe("declined");
    expect(bidderReofferStatus(rec("expired", true))).toBe("ended");
    expect(bidderReofferStatus(rec("withdrawn", true))).toBe("withdrawn");
  });

  it("shows nothing for steps the bidder never saw", () => {
    for (const status of [
      "awaiting_seller",
      "ready",
      "seller_declined",
      "seller_lapsed",
    ] as const) {
      expect(bidderReofferStatus(rec(status))).toBeNull();
    }
    expect(bidderReofferStatus(rec("withdrawn"))).toBeNull();
  });

  it("only ever yields a bidder status", () => {
    for (const status of REOFFER_STATUSES) {
      for (const sent of [true, false]) {
        const shown = bidderReofferStatus(rec(status, sent));
        if (shown) expect(BIDDER_REOFFER_STATUSES).toContain(shown);
      }
    }
  });
});
