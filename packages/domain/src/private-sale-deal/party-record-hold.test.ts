import { describe, expect, it } from "vitest";
import {
  type PartyDealRecord,
  kycEvidenceHeldForDeals,
  partyEvidenceHold,
} from "./party-record-hold.js";

const NOW = new Date("2031-06-15T00:00:00Z");
const yearsAgo = (years: number, days = 0) => {
  const d = new Date(NOW);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return new Date(d.getTime() + days * 86_400_000);
};
const settled = (endedAt: Date | null) => ({
  stage: "settled" as const,
  agreedAt: yearsAgo(6),
  endedAt,
  hasComplianceCase: true,
});

describe("kycEvidenceHeldForDeals", () => {
  it("holds nothing for someone on no deal", () => {
    expect(kycEvidenceHeldForDeals([], NOW, 5)).toBe(false);
  });

  it.each(["proposed", "offer", "agreed", "cleared", "invoiced", "paid", "released"] as const)(
    "holds the evidence while a deal is %s",
    (stage) => {
      const open = { stage, agreedAt: null, endedAt: null, hasComplianceCase: false };
      expect(kycEvidenceHeldForDeals([open], NOW, 5)).toBe(true);
    },
  );

  it("holds the evidence until the retention has run from the end of a settled deal", () => {
    expect(kycEvidenceHeldForDeals([settled(yearsAgo(5, 1))], NOW, 5)).toBe(true);
    expect(kycEvidenceHeldForDeals([settled(yearsAgo(5, -1))], NOW, 5)).toBe(false);
  });

  it("follows a longer configured retention", () => {
    const ended = settled(yearsAgo(6));
    expect(kycEvidenceHeldForDeals([ended], NOW, 5)).toBe(false);
    expect(kycEvidenceHeldForDeals([ended], NOW, 10)).toBe(true);
  });

  it("holds the evidence when a deal's end is not recorded", () => {
    expect(kycEvidenceHeldForDeals([settled(null)], NOW, 5)).toBe(true);
  });

  it("holds the evidence while any one of several deals is retained", () => {
    expect(kycEvidenceHeldForDeals([settled(yearsAgo(9)), settled(yearsAgo(1))], NOW, 5)).toBe(
      true,
    );
    expect(kycEvidenceHeldForDeals([settled(yearsAgo(9)), settled(yearsAgo(8))], NOW, 5)).toBe(
      false,
    );
  });

  it("holds the evidence of a deal cancelled after agreement, as long as the retention", () => {
    const cancelled = (endedAt: Date) => ({
      stage: "cancelled" as const,
      agreedAt: yearsAgo(7),
      endedAt,
      hasComplianceCase: false,
    });
    expect(kycEvidenceHeldForDeals([cancelled(yearsAgo(2))], NOW, 5)).toBe(true);
    expect(kycEvidenceHeldForDeals([cancelled(yearsAgo(6))], NOW, 5)).toBe(false);
  });

  it("holds nothing for a deal withdrawn before agreement with no check since the enquiry", () => {
    const withdrawn = {
      stage: "cancelled" as const,
      agreedAt: null,
      endedAt: yearsAgo(1),
      hasComplianceCase: false,
    };
    expect(kycEvidenceHeldForDeals([withdrawn], NOW, 5)).toBe(false);
    expect(kycEvidenceHeldForDeals([{ ...withdrawn, hasComplianceCase: true }], NOW, 5)).toBe(true);
  });
});

describe("partyEvidenceHold", () => {
  const deal = (over: Partial<PartyDealRecord> = {}): PartyDealRecord => ({
    reference: "PS-0012",
    stage: "settled",
    agreedAt: yearsAgo(6),
    endedAt: yearsAgo(2),
    hasComplianceCase: true,
    lastChangeAt: yearsAgo(2),
    ...over,
  });

  it("says nothing is held, and nothing needs a look, for no deals or ended ones", () => {
    expect(partyEvidenceHold([], NOW, 5)).toEqual({
      held: false,
      reasons: [],
      heldUntil: null,
      withoutEnd: false,
      stale: false,
    });
    expect(partyEvidenceHold([deal({ endedAt: yearsAgo(6) })], NOW, 5).held).toBe(false);
  });

  it("names the deal and the date a running hold ends", () => {
    const hold = partyEvidenceHold([deal()], NOW, 5);
    expect(hold.held).toBe(true);
    expect(hold.reasons).toEqual([
      { reference: "PS-0012", kind: "running", heldUntil: yearsAgo(-3), stale: false },
    ]);
    expect(hold.heldUntil).toEqual(yearsAgo(-3));
    expect(hold.withoutEnd).toBe(false);
  });

  it("gives the latest end when several deals hold, and no end while one is open", () => {
    const later = deal({ reference: "PS-0013", endedAt: yearsAgo(1) });
    expect(partyEvidenceHold([deal(), later], NOW, 5).heldUntil).toEqual(yearsAgo(-4));
    const open = deal({
      reference: "PS-0014",
      stage: "paid",
      endedAt: null,
      lastChangeAt: yearsAgo(1),
    });
    const hold = partyEvidenceHold([deal(), open], NOW, 5);
    expect(hold.heldUntil).toBeNull();
    expect(hold.reasons.map((reason) => reason.kind)).toEqual(["running", "open"]);
  });

  it("flags a hold with no end date, which nothing will release by itself", () => {
    const hold = partyEvidenceHold([deal({ endedAt: null })], NOW, 5);
    expect(hold).toMatchObject({ held: true, withoutEnd: true, heldUntil: null });
    expect(hold.reasons[0]).toMatchObject({ kind: "end_unknown", heldUntil: null });
  });

  it("flags an open deal that has not changed stage for longer than the retention period", () => {
    const stale = deal({
      stage: "offer",
      endedAt: null,
      agreedAt: null,
      lastChangeAt: yearsAgo(6),
    });
    expect(partyEvidenceHold([stale], NOW, 5)).toMatchObject({ held: true, stale: true });
    const recent = { ...stale, lastChangeAt: yearsAgo(4) };
    expect(partyEvidenceHold([recent], NOW, 5)).toMatchObject({ held: true, stale: false });
    expect(partyEvidenceHold([{ ...stale, lastChangeAt: null }], NOW, 5).stale).toBe(false);
  });

  it("does not flag a deal that no longer holds anything", () => {
    const withdrawn = deal({
      stage: "cancelled",
      agreedAt: null,
      hasComplianceCase: false,
      endedAt: yearsAgo(1),
    });
    expect(partyEvidenceHold([withdrawn], NOW, 5)).toMatchObject({
      held: false,
      withoutEnd: false,
      stale: false,
    });
  });

  it("follows a longer configured retention", () => {
    const ended = deal({ endedAt: yearsAgo(6) });
    expect(partyEvidenceHold([ended], NOW, 5).held).toBe(false);
    expect(partyEvidenceHold([ended], NOW, 10).heldUntil).toEqual(yearsAgo(-4));
  });
});
