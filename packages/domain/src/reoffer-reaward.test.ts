import { describe, expect, it } from "vitest";
import { canTransition, targetStatusForKind } from "./lot-transitions.js";
import { type ReawardGuardFacts, reawardGuard } from "./reoffer-reaward.js";

const acceptedAt = new Date("2026-11-12T10:00:00Z");
const offerOf = (over: Partial<ReawardGuardFacts["offer"]> = {}): ReawardGuardFacts["offer"] => ({
  lotId: "lot-1",
  buyerDefaultId: "default-1",
  status: "accepted",
  respondedAt: acceptedAt,
  offeredUserId: "user-2",
  offeredLegalEntityId: "entity-2",
  amountPence: 90_000,
  sourceBid: { lotId: "lot-1", bidderId: "user-2", legalEntityId: "entity-2", amountPence: 90_000 },
  ...over,
});

const facts = (over: Partial<ReawardGuardFacts> = {}): ReawardGuardFacts => ({
  lot: { id: "lot-1", status: "ended", winnerId: null },
  offer: offerOf(),
  latestDefault: { id: "default-1", lotId: "lot-1" },
  payments: [],
  otherOffers: [],
  ...over,
});

describe("reaward transition", () => {
  it("moves an ended lot to ended and nothing else", () => {
    expect(canTransition("ended", "reaward")).toBe(true);
    expect(targetStatusForKind("reaward")).toBe("ended");
    for (const status of ["draft", "scheduled", "active", "cancelled", "voided"] as const) {
      expect(canTransition(status, "reaward")).toBe(false);
    }
  });
});

describe("reawardGuard", () => {
  it("allows an accepted offer on an ended lot with no payment in the way", () => {
    expect(reawardGuard(facts())).toEqual({ ok: true });
    expect(
      reawardGuard(
        facts({
          payments: [{ status: "cancelled" }, { status: "expired" }, { status: "pending" }],
          otherOffers: [
            { status: "declined", offerSentAt: new Date() },
            { status: "expired", offerSentAt: new Date() },
          ],
        }),
      ),
    ).toEqual({ ok: true });
  });

  it.each(["awaiting_seller", "ready", "offered", "declined", "expired", "withdrawn"] as const)(
    "refuses an offer that is %s, not accepted",
    (status) => {
      const result = reawardGuard(facts({ offer: offerOf({ status }) }));
      expect(result).toMatchObject({ ok: false, code: "offer_not_accepted" });
    },
  );

  it("refuses an accepted offer with no time of acceptance", () => {
    expect(reawardGuard(facts({ offer: offerOf({ respondedAt: null }) }))).toMatchObject({
      ok: false,
      code: "offer_not_accepted",
    });
  });

  it("refuses an offer of another lot", () => {
    expect(
      reawardGuard(
        facts({
          offer: offerOf({ lotId: "lot-2" }),
          latestDefault: { id: "default-1", lotId: "lot-1" },
        }),
      ),
    ).toMatchObject({
      ok: false,
      code: "offer_not_for_lot",
    });
  });

  it.each(["draft", "scheduled", "active", "cancelled", "voided"] as const)(
    "refuses a lot that is %s",
    (status) => {
      expect(reawardGuard(facts({ lot: { id: "lot-1", status, winnerId: null } }))).toMatchObject({
        ok: false,
        code: "lot_not_reawardable",
      });
    },
  );

  it("refuses a lot that already has a buyer", () => {
    expect(
      reawardGuard(facts({ lot: { id: "lot-1", status: "ended", winnerId: "user-9" } })),
    ).toMatchObject({ ok: false, code: "lot_has_buyer" });
  });

  it.each(["captured", "authorized", "requires_manual_review", "refunded"] as const)(
    "refuses when any payment on the lot is %s",
    (status) => {
      const result = reawardGuard(facts({ payments: [{ status: "cancelled" }, { status }] }));
      expect(result).toMatchObject({ ok: false, code: "payment_in_progress" });
    },
  );

  it("refuses when another offer of the default was accepted", () => {
    const result = reawardGuard(
      facts({ otherOffers: [{ status: "accepted", offerSentAt: new Date() }] }),
    );
    expect(result).toMatchObject({ ok: false, code: "already_re_offered" });
  });

  it("refuses an offer of an earlier default once the lot has defaulted again", () => {
    expect(
      reawardGuard(facts({ latestDefault: { id: "default-2", lotId: "lot-1" } })),
    ).toMatchObject({ ok: false, code: "offer_superseded" });
  });

  it("refuses when the lot has no default, or the latest default belongs to another lot", () => {
    expect(reawardGuard(facts({ latestDefault: null }))).toMatchObject({
      ok: false,
      code: "offer_superseded",
    });
    expect(
      reawardGuard(facts({ latestDefault: { id: "default-1", lotId: "lot-9" } })),
    ).toMatchObject({ ok: false, code: "offer_superseded" });
  });

  it.each([
    ["is missing", null],
    [
      "is on another lot",
      { lotId: "lot-9", bidderId: "user-2", legalEntityId: "entity-2", amountPence: 90_000 },
    ],
    ["is another bidder's", { lotId: "lot-1", bidderId: "user-3", amountPence: 90_000 }],
    [
      "is another entity's",
      { lotId: "lot-1", bidderId: "user-2", legalEntityId: "entity-9", amountPence: 90_000 },
    ],
    [
      "is for another amount",
      { lotId: "lot-1", bidderId: "user-2", legalEntityId: "entity-2", amountPence: 95_000 },
    ],
  ])("refuses when the source bid %s", (_name, sourceBid) => {
    expect(reawardGuard(facts({ offer: offerOf({ sourceBid }) }))).toMatchObject({
      ok: false,
      code: "offer_bid_mismatch",
    });
  });
});
