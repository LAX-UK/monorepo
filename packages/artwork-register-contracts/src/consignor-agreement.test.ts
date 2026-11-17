import { describe, expect, it } from "vitest";
import {
  AGREEMENT_NOTE_MAX,
  COMMISSION_BASIS_POINTS_MAX,
  CONSIGNOR_CHANGE_REASON_MAX,
  CONSIGNOR_CHECKBOX_FALLBACK_LAST_DAY,
  type ConsignorAgreement,
  LOWEST_PRICE_PENCE_MAX,
  agreementCovers,
  agreementDay,
  assessConsignorCover,
  checkLowestPrice,
  checkMoveAgreement,
  coveringAgreement,
  isCalendarDay,
  nextConsignorSetTime,
  parseAgreementTerms,
  planAgreementChange,
  planConsignorChange,
  sameConsignor,
} from "./consignor-agreement.js";

const PARTY = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function agreement(overrides: Partial<ConsignorAgreement> = {}): ConsignorAgreement {
  return {
    id: "a1",
    agreementId: "a1",
    version: 1,
    partyId: PARTY,
    places: ["lax_bid", "lax_art"],
    startsOn: "2026-03-03",
    endsOn: "2027-03-02",
    lowestPricePence: 200_000,
    commissionBasisPoints: 2500,
    signedFileKey: "consignor-agreements/a1/signed.pdf",
    note: null,
    status: "current",
    replacesId: null,
    createdBy: "staff:s1",
    createdAt: new Date("2026-03-03T10:00:00.000Z"),
    replacedAt: null,
    retiredAt: null,
    retiredBy: null,
    ...overrides,
  };
}

const TERMS = {
  places: ["lax_art", "lax_bid"],
  startsOn: "2026-03-03",
  endsOn: "2027-03-02",
  lowestPricePence: 200_000,
  commissionBasisPoints: 2500,
  signedFileKey: "consignor-agreements/a1/signed.pdf",
  note: "  Signed in the gallery  ",
};

describe("agreement terms", () => {
  it("keeps places in their fixed order, trims the note and keeps whole minor units", () => {
    expect(parseAgreementTerms(TERMS)).toEqual({
      ok: true,
      value: {
        places: ["lax_bid", "lax_art"],
        startsOn: "2026-03-03",
        endsOn: "2027-03-02",
        lowestPricePence: 200_000,
        commissionBasisPoints: 2500,
        signedFileKey: "consignor-agreements/a1/signed.pdf",
        note: "Signed in the gallery",
      },
    });
  });

  it("treats a missing end, price, commission or blank note as none", () => {
    const parsed = parseAgreementTerms({
      places: ["private_sale"],
      startsOn: "2026-03-03",
      endsOn: " ",
      signedFileKey: "k.pdf",
      note: "   ",
    });
    expect(parsed).toMatchObject({
      ok: true,
      value: { endsOn: null, lowestPricePence: null, commissionBasisPoints: null, note: null },
    });
  });

  it("lists every issue at once", () => {
    const parsed = parseAgreementTerms({
      places: [],
      startsOn: "2026-02-30",
      endsOn: "soon",
      lowestPricePence: 0,
      commissionBasisPoints: COMMISSION_BASIS_POINTS_MAX + 1,
      signedFileKey: " ",
      note: "n".repeat(AGREEMENT_NOTE_MAX + 1),
    });
    expect(parsed).toEqual({
      ok: false,
      issues: [
        { field: "places", reason: "required" },
        { field: "startsOn", reason: "invalid_date" },
        { field: "endsOn", reason: "invalid_date" },
        { field: "lowestPricePence", reason: "out_of_range" },
        { field: "commissionBasisPoints", reason: "out_of_range" },
        { field: "signedFileKey", reason: "required" },
        { field: "note", reason: "too_long" },
      ],
    });
  });

  it("refuses an unknown place rather than dropping it", () => {
    expect(parseAgreementTerms({ ...TERMS, places: ["lax_bid", "zoho"] })).toEqual({
      ok: false,
      issues: [{ field: "places", reason: "unknown_place" }],
    });
  });

  it("refuses an end before the start, and accepts a one-day agreement", () => {
    expect(parseAgreementTerms({ ...TERMS, endsOn: "2026-03-02" })).toEqual({
      ok: false,
      issues: [{ field: "endsOn", reason: "before_start" }],
    });
    expect(parseAgreementTerms({ ...TERMS, endsOn: "2026-03-03" }).ok).toBe(true);
  });

  it("refuses fractional or oversized amounts and accepts the edges", () => {
    for (const lowestPricePence of [1.5, -1, LOWEST_PRICE_PENCE_MAX + 1]) {
      expect(parseAgreementTerms({ ...TERMS, lowestPricePence }).ok).toBe(false);
    }
    for (const commissionBasisPoints of [12.5, -1]) {
      expect(parseAgreementTerms({ ...TERMS, commissionBasisPoints }).ok).toBe(false);
    }
    expect(parseAgreementTerms({ ...TERMS, lowestPricePence: LOWEST_PRICE_PENCE_MAX }).ok).toBe(
      true,
    );
    expect(parseAgreementTerms({ ...TERMS, commissionBasisPoints: 0 }).ok).toBe(true);
    expect(
      parseAgreementTerms({ ...TERMS, commissionBasisPoints: COMMISSION_BASIS_POINTS_MAX }).ok,
    ).toBe(true);
  });

  it("refuses a file key with spaces, a leading slash or a parent path", () => {
    for (const signedFileKey of [
      "a b.pdf",
      "/abs.pdf",
      "../up.pdf",
      "a/../b.pdf",
      "a//b.pdf",
      "a/./b.pdf",
      "a/",
      "k".repeat(513),
    ]) {
      expect(parseAgreementTerms({ ...TERMS, signedFileKey })).toEqual({
        ok: false,
        issues: [{ field: "signedFileKey", reason: "invalid" }],
      });
    }
  });

  it("knows real calendar days", () => {
    expect(isCalendarDay("2028-02-29")).toBe(true);
    expect(isCalendarDay("2027-02-29")).toBe(false);
    expect(isCalendarDay("2027-1-01")).toBe(false);
  });
});

describe("whether an agreement covers a place on a day", () => {
  it("covers its places from the first to the last day, both included", () => {
    const a = agreement();
    expect(agreementCovers(a, "lax_bid", "2026-03-03")).toBe(true);
    expect(agreementCovers(a, "lax_art", "2027-03-02")).toBe(true);
    expect(agreementCovers(a, "lax_bid", "2026-03-02")).toBe(false);
    expect(agreementCovers(a, "lax_bid", "2027-03-03")).toBe(false);
    expect(agreementCovers(a, "private_sale", "2026-06-01")).toBe(false);
  });

  it("runs until retired when it has no end", () => {
    expect(agreementCovers(agreement({ endsOn: null }), "lax_bid", "2099-01-01")).toBe(true);
  });

  it("covers nothing once replaced or retired", () => {
    expect(agreementCovers(agreement({ status: "replaced" }), "lax_bid", "2026-06-01")).toBe(false);
    expect(agreementCovers(agreement({ status: "retired" }), "lax_bid", "2026-06-01")).toBe(false);
  });

  it("reads today as the London day", () => {
    // 23:30 UTC on 30 June is 00:30 on 1 July in London (summer time).
    expect(agreementDay(new Date("2026-06-30T23:30:00.000Z"))).toBe("2026-07-01");
    expect(agreementDay(new Date("2026-12-31T23:30:00.000Z"))).toBe("2026-12-31");
  });

  it("picks the agreement that runs longest when several cover", () => {
    const short = agreement({ id: "short", endsOn: "2026-12-31" });
    const long = agreement({ id: "long", endsOn: "2027-06-30" });
    const open = agreement({ id: "open", endsOn: null });
    expect(coveringAgreement([short, long], "lax_bid", "2026-06-01")?.id).toBe("long");
    expect(coveringAgreement([short, long, open], "lax_bid", "2026-06-01")?.id).toBe("open");
    expect(coveringAgreement([short], "private_sale", "2026-06-01")).toBeNull();
  });
});

describe("consignor cover for a move", () => {
  const day = "2026-06-01";

  it("says when no consignor is set and when LAX owns the work", () => {
    expect(
      assessConsignorCover({ consignor: null, agreements: [agreement()], place: "lax_bid", day }),
    ).toEqual({ kind: "no_consignor" });
    expect(
      assessConsignorCover({
        consignor: { kind: "lax" },
        agreements: [],
        place: "lax_bid",
        day,
      }),
    ).toEqual({ kind: "lax_owns" });
  });

  it("reads only the consignor's own agreements", () => {
    const theirs = agreement({ partyId: OTHER });
    expect(
      assessConsignorCover({
        consignor: { kind: "client", partyId: PARTY },
        agreements: [theirs],
        place: "lax_bid",
        day,
      }),
    ).toEqual({ kind: "not_covered", partyId: PARTY });
    const mine = agreement();
    expect(
      assessConsignorCover({
        consignor: { kind: "client", partyId: PARTY },
        agreements: [theirs, mine],
        place: "lax_bid",
        day,
      }),
    ).toEqual({ kind: "covered", partyId: PARTY, agreement: mine });
  });

  it("blocks LAX Bid when not covered, and never blocks lax.art in the first release", () => {
    const notCovered = { kind: "not_covered", partyId: PARTY } as const;
    expect(checkMoveAgreement({ cover: notCovered, place: "lax_bid", day })).toEqual({
      outcome: "blocked",
      reason: "not_covered",
    });
    expect(checkMoveAgreement({ cover: notCovered, place: "lax_art", day })).toEqual({
      outcome: "allowed",
    });
    expect(
      checkMoveAgreement({ cover: { kind: "lax_owns" }, place: "lax_bid", day: "2030-01-01" }),
    ).toEqual({ outcome: "allowed" });
    expect(
      checkMoveAgreement({
        cover: { kind: "covered", partyId: PARTY, agreement: agreement() },
        place: "lax_bid",
        day,
      }),
    ).toEqual({ outcome: "allowed" });
  });

  it("falls back to the checkbox for a work with no consignor until 31 January 2027", () => {
    const cover = { kind: "no_consignor" } as const;
    expect(CONSIGNOR_CHECKBOX_FALLBACK_LAST_DAY).toBe("2027-01-31");
    expect(checkMoveAgreement({ cover, place: "lax_bid", day: "2027-01-31" })).toEqual({
      outcome: "checkbox_fallback",
    });
    expect(checkMoveAgreement({ cover, place: "lax_bid", day: "2027-02-01" })).toEqual({
      outcome: "blocked",
      reason: "no_consignor",
    });
    expect(checkMoveAgreement({ cover, place: "lax_art", day: "2027-02-01" })).toEqual({
      outcome: "allowed",
    });
  });
});

describe("lowest price", () => {
  it("warns below the lowest price and is quiet at or above it", () => {
    const a = agreement({ lowestPricePence: 200_000 });
    expect(checkLowestPrice(a, 199_999)).toEqual({ status: "below", lowestPricePence: 200_000 });
    expect(checkLowestPrice(a, 200_000)).toEqual({
      status: "at_or_above",
      lowestPricePence: 200_000,
    });
    expect(checkLowestPrice(agreement({ lowestPricePence: null }), 1)).toEqual({
      status: "no_lowest_price",
    });
  });
});

describe("replacing and retiring", () => {
  it("changes only the current version at the version staff read", () => {
    expect(planAgreementChange({ current: null, expectedVersion: 1 })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(
      planAgreementChange({ current: { status: "retired", version: 1 }, expectedVersion: 1 }),
    ).toEqual({ ok: false, reason: "not_current" });
    expect(
      planAgreementChange({ current: { status: "current", version: 2 }, expectedVersion: 1 }),
    ).toEqual({ ok: false, reason: "stale" });
    expect(
      planAgreementChange({ current: { status: "current", version: 2 }, expectedVersion: 2 }),
    ).toEqual({ ok: true, nextVersion: 3 });
  });
});

describe("the consignor of an original", () => {
  const client = { kind: "client", partyId: PARTY } as const;

  it("compares consignors", () => {
    expect(sameConsignor(client, { kind: "client", partyId: PARTY })).toBe(true);
    expect(sameConsignor(client, { kind: "client", partyId: OTHER })).toBe(false);
    expect(sameConsignor({ kind: "lax" }, { kind: "lax" })).toBe(true);
    expect(sameConsignor(client, { kind: "lax" })).toBe(false);
    expect(sameConsignor(null, client)).toBe(false);
  });

  it("needs no reason the first time, and a reason for any change after", () => {
    expect(planConsignorChange({ current: null, next: client, reason: undefined })).toEqual({
      ok: true,
      changes: true,
      reason: null,
    });
    expect(planConsignorChange({ current: client, next: { kind: "lax" }, reason: "  " })).toEqual({
      ok: false,
      reason: "reason_required",
    });
    expect(
      planConsignorChange({ current: client, next: { kind: "lax" }, reason: " Bought outright " }),
    ).toEqual({ ok: true, changes: true, reason: "Bought outright" });
    expect(
      planConsignorChange({
        current: client,
        next: { kind: "lax" },
        reason: "r".repeat(CONSIGNOR_CHANGE_REASON_MAX + 1),
      }),
    ).toEqual({ ok: false, reason: "reason_too_long" });
  });

  it("records nothing when the consignor is already so", () => {
    expect(
      planConsignorChange({
        current: client,
        next: { kind: "client", partyId: PARTY },
        reason: null,
      }),
    ).toEqual({ ok: true, changes: false });
  });

  it("keeps each change after the one before it", () => {
    const now = new Date("2026-11-17T10:00:00.000Z");
    expect(nextConsignorSetTime(now, null)).toBe(now);
    expect(nextConsignorSetTime(now, new Date("2026-11-17T10:00:00.000Z")).toISOString()).toBe(
      "2026-11-17T10:00:00.001Z",
    );
  });
});
