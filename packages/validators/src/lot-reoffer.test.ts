import { BIDDER_REOFFER_STATUSES } from "@auction/domain";
import { describe, expect, it } from "vitest";
import {
  acceptReofferBodySchema,
  bidderReofferPriceSchema,
  bidderReofferViewSchema,
  declineReofferBodySchema,
  recordSellerAnswerBodySchema,
  sellerReofferAnswerBodySchema,
  sellerReofferViewSchema,
  sendReofferBodySchema,
  staffReofferSchema,
  withdrawReofferBodySchema,
} from "./lot-reoffer.js";

const sellerView = {
  id: "r1",
  lotId: "l1",
  lotTitle: "The Winter Study",
  lotNumber: 2,
  lotEndedAt: "2026-10-29T18:00:00.000Z",
  status: "awaiting_seller",
  consentStatus: "requested",
  offerMinor: 82_000_00,
  proceeds: {
    offerSaleMinor: 102_500_00,
    offerProceedsMinor: 97_375_00,
    originalHammerMinor: 88_000_00,
    originalProceedsMinor: 104_500_00,
  },
  reserveMinor: 85_000_00,
  belowReserve: true,
  answerDueAt: "2026-11-16T17:00:00.000Z",
  answeredAt: null,
  answeredBy: null,
  declinePreference: null,
  offerEndsAt: null,
  soldAt: null,
};

/** The lines today's invoice carries: the hammer and the buyer's premium, nothing else. */
const price = {
  hammerMinor: 82_000_00,
  buyersPremiumMinor: 20_500_00,
  vatOnPremiumMinor: null,
  vatOnLotMinor: null,
  artistsResaleRightMinor: null,
  totalMinor: 102_500_00,
};

const bidderView = {
  id: "r1",
  lotId: "l1",
  lotTitle: "The Winter Study",
  lotNumber: 2,
  saleId: "s1",
  lotImage: "https://media.example/winter-study.jpg",
  lotEndedAt: "2026-10-29T17:00:00.000Z",
  status: "offered",
  price,
  endsAt: "2026-11-13T17:00:00.000Z",
  respondedAt: null,
  invoiceDueAt: null,
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

  it("takes the seller's preference on a refusal only", () => {
    const refused = { answer: "refused", note: "By phone", declinePreference: "later_sale" };
    expect(recordSellerAnswerBodySchema.safeParse(refused).success).toBe(true);
    expect(recordSellerAnswerBodySchema.safeParse({ ...refused, answer: "given" }).success).toBe(
      false,
    );
    expect(
      recordSellerAnswerBodySchema.safeParse({ ...refused, declinePreference: "sell_it" }).success,
    ).toBe(false);
  });
});

describe("seller answer", () => {
  it("is a yes with no preference, or a no that says what to do with the lot", () => {
    expect(sellerReofferAnswerBodySchema.safeParse({ answer: "given" }).success).toBe(true);
    expect(
      sellerReofferAnswerBodySchema.safeParse({
        answer: "refused",
        declinePreference: "talk_to_us",
      }).success,
    ).toBe(true);
    expect(sellerReofferAnswerBodySchema.safeParse({ answer: "refused" }).success).toBe(false);
    expect(
      sellerReofferAnswerBodySchema.safeParse({ answer: "given", declinePreference: "later_sale" })
        .success,
    ).toBe(false);
  });
});

describe("bidder accept and decline", () => {
  it("accepting needs the terms ticked and the total the page showed", () => {
    const shown = { termsAccepted: true, expectedTotalMinor: 102_500_00 };
    expect(acceptReofferBodySchema.safeParse(shown).success).toBe(true);
    expect(acceptReofferBodySchema.safeParse({ ...shown, termsAccepted: false }).success).toBe(
      false,
    );
    expect(acceptReofferBodySchema.safeParse({ termsAccepted: true }).success).toBe(false);
    expect(acceptReofferBodySchema.safeParse({}).success).toBe(false);
    expect(acceptReofferBodySchema.safeParse({ ...shown, price: 1 }).success).toBe(false);
  });

  it("the total shown is whole, non-negative pence", () => {
    for (const expectedTotalMinor of [-1, 1.5, "102500", null]) {
      expect(
        acceptReofferBodySchema.safeParse({ termsAccepted: true, expectedTotalMinor }).success,
      ).toBe(false);
    }
  });

  it("declining takes an optional trimmed reason of up to 500 characters", () => {
    expect(declineReofferBodySchema.parse({})).toEqual({});
    expect(declineReofferBodySchema.parse({ reason: "  Too late  " })).toEqual({
      reason: "Too late",
    });
    expect(declineReofferBodySchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
    expect(declineReofferBodySchema.safeParse({ reason: "x", other: 1 }).success).toBe(false);
  });
});

describe("bidder price", () => {
  it("adds up", () => {
    expect(bidderReofferPriceSchema.safeParse(price).success).toBe(true);
  });

  it("adds up for a lot that carries VAT and the Artist's Resale Right", () => {
    const withAll = {
      hammerMinor: 10_000_00,
      buyersPremiumMinor: 2_500_00,
      vatOnPremiumMinor: 500_00,
      vatOnLotMinor: 2_000_00,
      artistsResaleRightMinor: 400_00,
      totalMinor: 15_400_00,
    };
    expect(bidderReofferPriceSchema.safeParse(withAll).success).toBe(true);
    expect(bidderReofferPriceSchema.safeParse({ ...withAll, totalMinor: 15_000_00 }).success).toBe(
      false,
    );
  });

  it("adds up for a lot with no buyer's premium line", () => {
    expect(
      bidderReofferPriceSchema.safeParse({
        ...price,
        buyersPremiumMinor: null,
        totalMinor: price.hammerMinor,
      }).success,
    ).toBe(true);
  });

  it("names every line, null when the invoice has none, never leaves one out", () => {
    const { vatOnPremiumMinor: _omitted, ...withoutVat } = price;
    expect(bidderReofferPriceSchema.safeParse(withoutVat).success).toBe(false);
  });

  it("refuses a total that does not match its lines", () => {
    expect(
      bidderReofferPriceSchema.safeParse({ ...price, totalMinor: price.totalMinor + 1 }).success,
    ).toBe(false);
  });
});

describe("member-safe views", () => {
  it("accept their own fields", () => {
    expect(sellerReofferViewSchema.safeParse(sellerView).success).toBe(true);
    expect(bidderReofferViewSchema.safeParse(bidderView).success).toBe(true);
  });

  it("let the seller's view leave out the money for a member who does not see the payouts", () => {
    expect(sellerReofferViewSchema.safeParse({ ...sellerView, proceeds: null }).success).toBe(true);
    const { proceeds: _money, ...withoutKey } = sellerView;
    expect(sellerReofferViewSchema.safeParse(withoutKey).success).toBe(false);
    const flat = { ...withoutKey, proceeds: null, estimatedProceedsMinor: 1 };
    expect(sellerReofferViewSchema.safeParse(flat).success).toBe(false);
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
    const keys = Object.keys(sellerReofferViewSchema.shape);
    for (const forbidden of [
      "claimableShortfall",
      "bidder",
      "skippedBidders",
      "premiumLostMinor",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("tell the seller how an answer reached us, and no more than that", () => {
    const answered = {
      ...sellerView,
      answeredAt: "2026-11-12T10:00:00.000Z",
      answeredBy: "recorded_by_staff",
      declinePreference: "later_sale",
    };
    expect(sellerReofferViewSchema.safeParse(answered).success).toBe(true);
    // Staff-only channels never reach a seller.
    expect(
      sellerReofferViewSchema.safeParse({ ...answered, answeredBy: "house_stock" }).success,
    ).toBe(false);
  });

  it("show the bidder only bidder-side statuses", () => {
    for (const status of BIDDER_REOFFER_STATUSES) {
      expect(bidderReofferViewSchema.safeParse({ ...bidderView, status }).success).toBe(true);
    }
    for (const status of [
      "awaiting_seller",
      "ready",
      "seller_declined",
      "seller_lapsed",
      "expired",
    ]) {
      expect(bidderReofferViewSchema.safeParse({ ...bidderView, status }).success).toBe(false);
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
      skippedBidders: [
        { userId: "u3", legalEntityId: "e3", amountMinor: 90_000_00, reason: "suspended" },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});
