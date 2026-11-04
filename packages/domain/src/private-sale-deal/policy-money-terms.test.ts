import { describe, expect, it } from "vitest";
import { meetsAmlThreshold, sourceOfFundsRequired } from "./clearance.js";
import { BUYER, SELLER, acceptedTerms, deal } from "./deal-fixtures.test-util.js";
import { dealCreatedEvent, dealStageChangedEvent } from "./events.js";
import { basisPointsOf, computeDealMoney } from "./money.js";
import {
  DEFAULT_AML_THRESHOLD_MINOR,
  DEFAULT_BUYER_FEE_BPS,
  DEFAULT_SOURCE_OF_FUNDS_THRESHOLD_MINOR,
  initialDealTerms,
  privateSalePolicyGaps,
  resolvePrivateSalePolicy,
} from "./policy.js";
import { dealTermIsEditable, editableDealTerms, termsAcceptance } from "./terms.js";

describe("private sale policy", () => {
  it("carries only the approved defaults when nothing is configured", () => {
    const policy = resolvePrivateSalePolicy();
    expect(policy).toEqual({
      commissionRateBps: null,
      buyerFeeBps: 0,
      vatTreatments: [],
      sourceOfFundsThresholdMinor: 900_000,
      amlThresholdMinor: 1_000_000,
      termsVersion: null,
      paymentDueDays: null,
      collectionDueDays: null,
    });
    expect(DEFAULT_SOURCE_OF_FUNDS_THRESHOLD_MINOR).toBe(900_000);
    expect(DEFAULT_AML_THRESHOLD_MINOR).toBe(1_000_000);
    expect(DEFAULT_BUYER_FEE_BPS).toBe(0);
  });

  it("names what must be configured before a real deal", () => {
    expect(privateSalePolicyGaps(resolvePrivateSalePolicy())).toEqual([
      "terms_version",
      "commission_rate",
      "vat_treatments",
      "payment_due_days",
    ]);
    expect(
      privateSalePolicyGaps(
        resolvePrivateSalePolicy({
          commissionRateBps: 1000,
          termsVersion: "v1",
          paymentDueDays: 7,
          vatTreatments: [{ code: "margin_scheme", label: "Margin scheme" }],
        }),
      ),
    ).toEqual([]);
  });

  it("treats a blank terms version as not configured", () => {
    expect(resolvePrivateSalePolicy({ termsVersion: "  " }).termsVersion).toBeNull();
  });

  it("starts a deal with no buyer's fee and the configured commission", () => {
    expect(initialDealTerms(resolvePrivateSalePolicy())).toEqual({
      buyerFeeBps: 0,
      sellerCommissionBps: null,
    });
    expect(initialDealTerms(resolvePrivateSalePolicy({ commissionRateBps: 1200 }))).toEqual({
      buyerFeeBps: 0,
      sellerCommissionBps: 1200,
    });
  });

  it.each([
    [{ commissionRateBps: 10_001 }],
    [{ commissionRateBps: -1 }],
    [{ buyerFeeBps: 1.5 }],
    [{ paymentDueDays: 0 }],
    [{ collectionDueDays: 400 }],
    [{ sourceOfFundsThresholdMinor: -1 }],
    [{ vatTreatments: [{ code: "Margin Scheme", label: "x" }] }],
    [{ vatTreatments: [{ code: "margin", label: " " }] }],
    [
      {
        vatTreatments: [
          { code: "a", label: "A" },
          { code: "a", label: "B" },
        ],
      },
    ],
  ])("rejects a configuration that cannot be right: %j", (input) => {
    expect(() => resolvePrivateSalePolicy(input)).toThrow(RangeError);
  });
});

describe("thresholds", () => {
  it("asks for source of funds from the threshold, counting the buyer's other open deals", () => {
    const input = { buyerOtherOpenExposureMinor: 0, thresholdMinor: 900_000 };
    expect(sourceOfFundsRequired({ ...input, priceMinor: 899_999 })).toBe(false);
    expect(sourceOfFundsRequired({ ...input, priceMinor: 900_000 })).toBe(true);
    expect(
      sourceOfFundsRequired({
        ...input,
        priceMinor: 400_000,
        buyerOtherOpenExposureMinor: 500_000,
      }),
    ).toBe(true);
  });

  it("knows when a price reaches the AML threshold", () => {
    expect(meetsAmlThreshold(999_999, 1_000_000)).toBe(false);
    expect(meetsAmlThreshold(1_000_000, 1_000_000)).toBe(true);
  });
});

describe("deal money", () => {
  it("adds the buyer's fee to what the buyer pays and takes commission and costs from the seller", () => {
    expect(
      computeDealMoney({
        priceMinor: 4_800_000,
        buyerFeeBps: 0,
        sellerCommissionBps: 1500,
        costsMinor: 35_000,
      }),
    ).toEqual({
      priceMinor: 4_800_000,
      buyerFeeMinor: 0,
      totalDueMinor: 4_800_000,
      sellerCommissionMinor: 720_000,
      costsMinor: 35_000,
      netToSellerMinor: 4_045_000,
    });
  });

  it("leaves the seller's lines unknown until the commission is set", () => {
    const money = computeDealMoney({
      priceMinor: 100_000,
      buyerFeeBps: 250,
      sellerCommissionBps: null,
      costsMinor: 0,
    });
    expect(money.buyerFeeMinor).toBe(2_500);
    expect(money.totalDueMinor).toBe(102_500);
    expect(money.sellerCommissionMinor).toBeNull();
    expect(money.netToSellerMinor).toBeNull();
  });

  it("rounds half a penny up", () => {
    expect(basisPointsOf(10_001, 5_000)).toBe(5_001);
    expect(basisPointsOf(1, 4_999)).toBe(0);
    expect(basisPointsOf(1, 5_000)).toBe(1);
  });
});

describe("terms", () => {
  it("counts an acceptance of the current version by the party now on the deal", () => {
    const base = deal({ buyer: BUYER });
    expect(termsAcceptance(base, [], "v1")).toEqual({ seller: false, buyer: false });
    expect(termsAcceptance(base, [acceptedTerms(SELLER)], "v1")).toEqual({
      seller: true,
      buyer: false,
    });
    expect(termsAcceptance(base, [acceptedTerms(SELLER), acceptedTerms(BUYER)], "v1")).toEqual({
      seller: true,
      buyer: true,
    });
  });

  it("does not count another version, an unaccepted row or a replaced buyer", () => {
    const base = deal({ buyer: BUYER });
    expect(termsAcceptance(base, [acceptedTerms(SELLER, "v0")], "v1").seller).toBe(false);
    expect(
      termsAcceptance(base, [{ ...acceptedTerms(SELLER), acceptedAt: null }], "v1").seller,
    ).toBe(false);
    const replaced = deal({ buyer: { ...BUYER, legalEntityId: "le-other" } });
    expect(termsAcceptance(replaced, [acceptedTerms(BUYER)], "v1").buyer).toBe(false);
    expect(termsAcceptance(deal(), [acceptedTerms(BUYER)], "v1").buyer).toBe(false);
  });

  it("fixes the price at agreement and everything at the invoice", () => {
    expect(dealTermIsEditable("offer", "price")).toBe(true);
    expect(dealTermIsEditable("agreed", "price")).toBe(false);
    expect(dealTermIsEditable("cleared", "vatTreatment")).toBe(true);
    for (const stage of ["invoiced", "paid", "released", "settled", "cancelled"] as const) {
      expect(editableDealTerms(stage)).toEqual([]);
    }
  });
});

describe("events", () => {
  it("carry identifiers and stage codes only", () => {
    const d = deal();
    expect(dealCreatedEvent(d)).toEqual({
      eventType: "private_sale_deal.created",
      payload: { dealId: "deal-1", reference: "PS-0001", stage: "proposed" },
    });
    expect(dealStageChangedEvent(d, { from: "agreed", to: "cleared" })).toEqual({
      eventType: "private_sale_deal.stage_changed",
      payload: { dealId: "deal-1", reference: "PS-0001", from: "agreed", to: "cleared" },
    });
  });
});
