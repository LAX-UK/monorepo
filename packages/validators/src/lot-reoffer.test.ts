import { describe, expect, it } from "vitest";
import {
  bidderReofferViewSchema,
  recordSellerAnswerBodySchema,
  sellerReofferViewSchema,
  sendReofferBodySchema,
  staffReofferSchema,
  withdrawReofferBodySchema,
} from "./lot-reoffer.js";

const sellerView = {
  id: "r1",
  lotId: "l1",
  status: "awaiting_seller",
  consentStatus: "requested",
  offerMinor: 82_000_00,
  originalHammerMinor: 88_000_00,
  estimatedProceedsMinor: 72_160_00,
  originalProceedsMinor: 77_440_00,
  reserveMinor: 85_000_00,
  belowReserve: true,
  answerDueAt: "2026-11-16T10:00:00.000Z",
};

const bidderView = {
  id: "r1",
  lotId: "l1",
  status: "offered",
  hammerMinor: 82_000_00,
  buyersPremiumMinor: 20_500_00,
  vatMinor: 4_100_00,
  totalMinor: 106_600_00,
  endsAt: "2026-11-13T17:00:00.000Z",
};

describe("send body", () => {
  it("defaults to three days and allows 1 to 7", () => {
    expect(sendReofferBodySchema.parse({})).toEqual({ offerDays: 3 });
    expect(sendReofferBodySchema.parse({ offerDays: 7 }).offerDays).toBe(7);
    expect(sendReofferBodySchema.parse({ offerDays: 1 }).offerDays).toBe(1);
  });
  it("refuses other lengths and unknown fields", () => {
    for (const offerDays of [0, 8, 2.5]) {
      expect(sendReofferBodySchema.safeParse({ offerDays }).success).toBe(false);
    }
    expect(sendReofferBodySchema.safeParse({ offerDays: 3, price: 1 }).success).toBe(false);
  });
});

describe("staff notes", () => {
  it("requires a note when recording the seller's answer or withdrawing", () => {
    expect(recordSellerAnswerBodySchema.safeParse({ answer: "given" }).success).toBe(false);
    expect(recordSellerAnswerBodySchema.safeParse({ answer: "given", note: "  " }).success).toBe(
      false,
    );
    expect(
      recordSellerAnswerBodySchema.safeParse({ answer: "refused", note: "By phone" }).success,
    ).toBe(true);
    expect(recordSellerAnswerBodySchema.safeParse({ answer: "lapsed", note: "x" }).success).toBe(
      false,
    );
    expect(withdrawReofferBodySchema.safeParse({}).success).toBe(false);
  });
});

describe("member-safe views", () => {
  it("accept their own fields", () => {
    expect(sellerReofferViewSchema.safeParse(sellerView).success).toBe(true);
    expect(bidderReofferViewSchema.safeParse(bidderView).success).toBe(true);
  });

  it("reject staff fields and the other party's identity", () => {
    const leaks = [
      { claimableShortfall: { hammerDifferenceMinor: 0, premiumLostMinor: 0, totalMinor: 0 } },
      { bidder: { userId: "u", legalEntityId: "e" } },
      { skippedBidders: [] },
      { defaultingBuyerId: "u" },
      { sellerLegalEntityId: "e" },
    ];
    for (const leak of leaks) {
      expect(sellerReofferViewSchema.safeParse({ ...sellerView, ...leak }).success).toBe(false);
      expect(bidderReofferViewSchema.safeParse({ ...bidderView, ...leak }).success).toBe(false);
    }
  });

  it("carry no staff-only key in their shape", () => {
    for (const schema of [sellerReofferViewSchema, bidderReofferViewSchema]) {
      const keys = Object.keys(schema.shape);
      for (const forbidden of [
        "claimableShortfall",
        "bidder",
        "skippedBidders",
        "premiumLostMinor",
      ]) {
        expect(keys).not.toContain(forbidden);
      }
    }
  });
});

describe("staff view", () => {
  it("carries the shortfall and the bidder", () => {
    const parsed = staffReofferSchema.safeParse({
      id: "r1",
      lotId: "l1",
      sequence: 1,
      status: "ready",
      consentStatus: "given",
      bidder: { userId: "u2", legalEntityId: "e2" },
      offerMinor: 82_000_00,
      originalHammerMinor: 88_000_00,
      belowReserve: false,
      consentDueAt: null,
      offerEndsAt: null,
      claimableShortfall: {
        hammerDifferenceMinor: 6_000_00,
        premiumLostMinor: 22_000_00,
        totalMinor: 28_000_00,
      },
      skippedBidders: [],
    });
    expect(parsed.success).toBe(true);
  });
});
