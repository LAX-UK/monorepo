import { describe, expect, it } from "vitest";
import {
  type ConsignorAgreement,
  moveAgreementRecord,
  readMoveAgreement,
} from "./consignor-agreement.js";

const PARTY = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const CLIENT = { kind: "client", partyId: PARTY } as const;
const TODAY = "2026-11-17";

function agreement(overrides: Partial<ConsignorAgreement> = {}): ConsignorAgreement {
  return {
    id: "v1",
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
    createdBy: "staff:u1",
    createdAt: new Date("2026-03-03T10:00:00Z"),
    replacedAt: null,
    retiredAt: null,
    retiredBy: null,
    ...overrides,
  };
}

function read(
  agreements: ConsignorAgreement[],
  place: "lax_bid" | "lax_art" = "lax_bid",
  day = TODAY,
) {
  return readMoveAgreement({ consignor: CLIENT, agreements, place, day });
}

describe("readMoveAgreement", () => {
  it("is in force when an agreement covers the place today", () => {
    const reading = read([agreement()]);
    expect(reading).toMatchObject({
      state: "in_force",
      partyId: PARTY,
      check: { outcome: "allowed" },
    });
    expect(reading.agreement?.id).toBe("v1");
  });

  it("says not started when the only agreement for the place starts later, and blocks LAX Bid", () => {
    const reading = read([
      agreement({ id: "late", startsOn: "2027-01-10" }),
      agreement({ id: "later", startsOn: "2027-02-01" }),
    ]);
    expect(reading.state).toBe("not_started");
    expect(reading.agreement?.id).toBe("late");
    expect(reading.check).toEqual({ outcome: "blocked", reason: "not_covered" });
  });

  it("says expired for an agreement past its end date", () => {
    const reading = read([agreement({ endsOn: "2026-10-31" })]);
    expect(reading.state).toBe("expired");
    expect(reading.check.outcome).toBe("blocked");
  });

  it("says retired for a retired agreement", () => {
    const reading = read([
      agreement({ status: "retired", retiredAt: new Date("2026-09-01T09:00:00Z") }),
    ]);
    expect(reading.state).toBe("retired");
  });

  it("picks whichever stopped covering most recently, expired or retired", () => {
    const reading = read([
      agreement({ id: "old", endsOn: "2026-06-30" }),
      agreement({ id: "ret", status: "retired", retiredAt: new Date("2026-10-01T09:00:00Z") }),
    ]);
    expect(reading).toMatchObject({ state: "retired", agreement: { id: "ret" } });
  });

  it("prefers one waiting to start over one that ended", () => {
    const reading = read([
      agreement({ id: "old", endsOn: "2026-06-30" }),
      agreement({ id: "next", startsOn: "2026-12-01", endsOn: null }),
    ]);
    expect(reading).toMatchObject({ state: "not_started", agreement: { id: "next" } });
  });

  it("says none when no agreement names the place, ignoring replaced versions and other clients", () => {
    const reading = read([
      agreement({ places: ["private_sale"] }),
      agreement({ id: "rep", status: "replaced" }),
      agreement({ id: "theirs", partyId: OTHER }),
    ]);
    expect(reading).toMatchObject({ state: "none", partyId: PARTY, agreement: null });
    expect(reading.check).toEqual({ outcome: "blocked", reason: "not_covered" });
  });

  it("never blocks lax.art in the first release", () => {
    expect(read([], "lax_art").check).toEqual({ outcome: "allowed" });
    expect(read([agreement({ endsOn: "2026-01-01" })], "lax_art").state).toBe("expired");
  });

  it("falls back to the checkbox for a work with no consignor until 31 January 2027", () => {
    const before = readMoveAgreement({
      consignor: null,
      agreements: [],
      place: "lax_bid",
      day: "2027-01-31",
    });
    const after = readMoveAgreement({
      consignor: null,
      agreements: [],
      place: "lax_bid",
      day: "2027-02-01",
    });
    expect(before).toMatchObject({
      state: "no_consignor",
      check: { outcome: "checkbox_fallback" },
    });
    expect(after).toMatchObject({
      state: "no_consignor",
      check: { outcome: "blocked", reason: "no_consignor" },
    });
  });

  it("needs no agreement when LAX owns the work", () => {
    const reading = readMoveAgreement({
      consignor: { kind: "lax" },
      agreements: [],
      place: "lax_bid",
      day: TODAY,
    });
    expect(reading).toEqual({
      state: "lax_owns",
      partyId: null,
      agreement: null,
      check: { outcome: "allowed" },
    });
  });
});

describe("moveAgreementRecord", () => {
  it("keeps the place, state and agreement version", () => {
    expect(
      moveAgreementRecord(read([agreement({ id: "v2", version: 2 })]), "lax_bid", {
        belowLowestPrice: true,
      }),
    ).toEqual({
      place: "lax_bid",
      state: "in_force",
      consignorPartyId: PARTY,
      agreementId: "a1",
      agreementVersionId: "v2",
      version: 2,
      belowLowestPrice: true,
    });
  });

  it("keeps only the state when there is no consignor", () => {
    const reading = readMoveAgreement({
      consignor: null,
      agreements: [],
      place: "lax_art",
      day: TODAY,
    });
    expect(moveAgreementRecord(reading, "lax_art")).toEqual({
      place: "lax_art",
      state: "no_consignor",
    });
  });
});
