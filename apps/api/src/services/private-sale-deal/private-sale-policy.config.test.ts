import { privateSalePolicyGaps } from "@auction/domain";
import { describe, expect, it } from "vitest";
import {
  type PrivateSalePolicyEnv,
  parseVatTreatments,
  privateSalePolicyFromEnv,
} from "./private-sale-policy.config.js";

const EMPTY: PrivateSalePolicyEnv = {
  PRIVATE_SALE_COMMISSION_BPS: undefined,
  PRIVATE_SALE_BUYER_FEE_BPS: undefined,
  PRIVATE_SALE_VAT_TREATMENTS: undefined,
  PRIVATE_SALE_PAYMENT_DUE_DAYS: undefined,
  PRIVATE_SALE_COLLECTION_DUE_DAYS: undefined,
  PRIVATE_SALE_TERMS_VERSION: undefined,
  SOF_THRESHOLD_AMOUNT: 9000,
};

describe("privateSalePolicyFromEnv", () => {
  it("keeps every gated step blocked while nothing is configured", () => {
    const policy = privateSalePolicyFromEnv(EMPTY);
    expect(privateSalePolicyGaps(policy)).toEqual([
      "terms_version",
      "commission_rate",
      "vat_treatments",
      "payment_due_days",
    ]);
    expect(policy).toMatchObject({
      buyerFeeBps: 0,
      sourceOfFundsThresholdMinor: 900_000,
      amlThresholdMinor: 1_000_000,
    });
  });

  it("applies what is configured", () => {
    const policy = privateSalePolicyFromEnv({
      ...EMPTY,
      PRIVATE_SALE_COMMISSION_BPS: 1500,
      PRIVATE_SALE_BUYER_FEE_BPS: 250,
      PRIVATE_SALE_VAT_TREATMENTS: "margin_scheme:Margin scheme;agent:Agent's commission, only",
      PRIVATE_SALE_PAYMENT_DUE_DAYS: 7,
      PRIVATE_SALE_COLLECTION_DUE_DAYS: 14,
      PRIVATE_SALE_TERMS_VERSION: "v1",
      SOF_THRESHOLD_AMOUNT: 9500,
    });
    expect(privateSalePolicyGaps(policy)).toEqual([]);
    expect(policy).toMatchObject({
      commissionRateBps: 1500,
      buyerFeeBps: 250,
      paymentDueDays: 7,
      collectionDueDays: 14,
      termsVersion: "v1",
      sourceOfFundsThresholdMinor: 950_000,
      vatTreatments: [
        { code: "margin_scheme", label: "Margin scheme" },
        { code: "agent", label: "Agent's commission, only" },
      ],
    });
  });

  it("rejects values that cannot be right", () => {
    expect(() =>
      privateSalePolicyFromEnv({ ...EMPTY, PRIVATE_SALE_COMMISSION_BPS: 20_000 }),
    ).toThrow();
  });
});

describe("parseVatTreatments", () => {
  it("returns none for an empty setting and ignores blank pairs", () => {
    expect(parseVatTreatments(undefined)).toEqual([]);
    expect(parseVatTreatments(" ; ")).toEqual([]);
  });

  it("keeps colons after the first in the label", () => {
    expect(parseVatTreatments("a:Note: see terms")).toEqual([
      { code: "a", label: "Note: see terms" },
    ]);
  });

  it("refuses a pair without a code", () => {
    expect(() => parseVatTreatments("Margin scheme")).toThrow("code:Label");
    expect(() => parseVatTreatments(":Label")).toThrow("code:Label");
  });
});
