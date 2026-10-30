import { describe, expect, it } from "vitest";
import {
  type ApplicableBiddingLimit,
  BIDDING_LIMIT_ERROR_CODES,
  type ExposureCommitment,
  bindingBiddingLimit,
  decideBiddingLimits,
  exposureOf,
} from "./bidding-limits.js";

const c = (
  lotId: string,
  amount: number,
  over: Partial<ExposureCommitment> = {},
): ExposureCommitment => ({
  lotId,
  saleId: "sale-1",
  userId: "agent-a",
  kind: "leading_bid",
  amount,
  ...over,
});

describe("exposureOf", () => {
  it("is zero with no commitments", () => {
    expect(exposureOf([])).toBe(0);
  });

  it("sums one amount per lot", () => {
    expect(exposureOf([c("lot-1", 1000), c("lot-2", 2500.5)])).toBe(3500.5);
  });

  it("counts only the largest commitment on a lot, which can be won once", () => {
    const commitments = [
      c("lot-1", 1000, { kind: "leading_bid" }),
      c("lot-1", 4000, { kind: "maximum_bid" }),
      c("lot-1", 3000, { kind: "absentee_bid", userId: "agent-b" }),
    ];
    expect(exposureOf(commitments)).toBe(4000);
  });

  it("counts lots won and not paid for at their hammer price", () => {
    expect(exposureOf([c("lot-1", 1000), c("lot-9", 7200, { kind: "unpaid_win" })])).toBe(8200);
  });

  it("leaves out the lot a new bid is for", () => {
    expect(exposureOf([c("lot-1", 1000), c("lot-2", 2000)], {}, "lot-1")).toBe(2000);
  });

  it("narrows to one agent and one sale", () => {
    const commitments = [
      c("lot-1", 1000),
      c("lot-2", 2000, { userId: "agent-b" }),
      c("lot-3", 4000, { saleId: "sale-2" }),
      c("lot-4", 8000, { saleId: null, kind: "unpaid_win" }),
    ];
    expect(exposureOf(commitments, { userId: "agent-a" })).toBe(13000);
    expect(exposureOf(commitments, { userId: "agent-a", saleId: "sale-1" })).toBe(1000);
    expect(exposureOf(commitments, { saleId: null })).toBe(15000);
  });

  it("adds pence exactly", () => {
    expect(exposureOf([c("lot-1", 0.1), c("lot-2", 0.2)])).toBe(0.3);
  });

  it("ignores zero and negative amounts", () => {
    expect(exposureOf([c("lot-1", 0), c("lot-2", -5)])).toBe(0);
  });
});

describe("decideBiddingLimits: the lowest applicable limit wins", () => {
  const perLot = (limit: number): ApplicableBiddingLimit => ({
    kind: "per_lot",
    limit,
    exposure: 0,
  });
  const total = (limit: number, exposure: number): ApplicableBiddingLimit => ({
    kind: "authorisation_total",
    limit,
    exposure,
  });
  const org = (limit: number, exposure: number): ApplicableBiddingLimit => ({
    kind: "organisation",
    limit,
    exposure,
  });

  it.each([
    // [label, limits, amount, allowed, binding kind, available]
    ["no limits", [], 1_000_000, true, null, null],
    ["per lot only, under", [perLot(5000)], 5000, true, "per_lot", 5000],
    ["per lot only, over", [perLot(5000)], 5000.01, false, "per_lot", 5000],
    [
      "total binds below per lot",
      [perLot(5000), total(10_000, 7000)],
      3500,
      false,
      "authorisation_total",
      3000,
    ],
    [
      "per lot binds below total",
      [perLot(2000), total(10_000, 1000)],
      2500,
      false,
      "per_lot",
      2000,
    ],
    [
      "organisation binds below both",
      [perLot(9000), total(50_000, 0), org(250_000, 245_000)],
      6000,
      false,
      "organisation",
      5000,
    ],
    ["organisation alone, under", [org(250_000, 100_000)], 150_000, true, "organisation", 150_000],
    ["organisation already past (lowered)", [org(100_000, 120_000)], 1, false, "organisation", 0],
    [
      "tie names the more specific limit",
      [perLot(3000), total(10_000, 7000), org(5000, 2000)],
      3000.01,
      false,
      "per_lot",
      3000,
    ],
    [
      "tie between totals names the authorisation",
      [total(10_000, 7000), org(5000, 2000)],
      4000,
      false,
      "authorisation_total",
      3000,
    ],
  ] as const)("%s", (_label, limits, amount, allowed, kind, available) => {
    const decision = decideBiddingLimits(amount, limits);
    expect(decision.allowed).toBe(allowed);
    expect(decision.binding?.kind ?? null).toBe(kind);
    expect(decision.binding?.available ?? null).toBe(available);
  });

  it("allows a bid exactly at the room left", () => {
    expect(decideBiddingLimits(3000, [total(10_000, 7000)]).allowed).toBe(true);
  });

  it("never reports negative room", () => {
    expect(bindingBiddingLimit([org(1000, 5000)])?.available).toBe(0);
  });
});

describe("BIDDING_LIMIT_ERROR_CODES", () => {
  it("keeps the existing per-lot code and adds one per total", () => {
    expect(BIDDING_LIMIT_ERROR_CODES).toEqual({
      per_lot: "bid_limit_exceeded",
      authorisation_total: "authorisation_total_limit_exceeded",
      organisation: "organisation_limit_exceeded",
    });
  });
});
