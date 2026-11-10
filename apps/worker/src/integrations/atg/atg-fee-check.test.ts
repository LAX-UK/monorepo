import { describe, expect, it } from "vitest";
import { FEE_MISMATCH_PREFIX, describeFeeMismatch } from "./atg-fee-check.js";
import type { AtgRemoteAuctionFees } from "./atg-gateway.js";
import type { GapAuctionFields } from "./gap-types.js";

const sent = {
  BuyersPremium: 25,
  BuyersPremiumVatRate: 0.2,
  InternetSurchargeRate: 3,
  InternetSurchargeVatRate: 0.2,
} as GapAuctionFields;

const held = (patch: Partial<AtgRemoteAuctionFees> = {}): AtgRemoteAuctionFees => ({
  buyersPremium: 25,
  buyersPremiumVatRate: 0.2,
  internetSurchargeRate: 3,
  internetSurchargeVatRate: 0.2,
  ...patch,
});

describe("describeFeeMismatch", () => {
  it("is null when ATG holds what LAX sent", () => {
    expect(describeFeeMismatch(sent, held())).toBeNull();
  });

  it("accepts differences inside the 1e-6 tolerance and flags those outside it", () => {
    expect(describeFeeMismatch(sent, held({ buyersPremiumVatRate: 0.2 + 1e-7 }))).toBeNull();
    expect(describeFeeMismatch(sent, held({ buyersPremiumVatRate: 0.2 + 1e-5 }))).not.toBeNull();
  });

  it("names every field that differs, with both values (the 588% case)", () => {
    const message = describeFeeMismatch(
      sent,
      held({ buyersPremiumVatRate: 20, internetSurchargeVatRate: 20 }),
    );

    expect(message).toBe(
      `${FEE_MISMATCH_PREFIX}Buyer's premium VAT LAX sent 0.2, ATG has 20; Internet surcharge VAT LAX sent 0.2, ATG has 20.`,
    );
  });

  it("skips fields ATG did not return or LAX did not send", () => {
    const { BuyersPremium: _omitted, ...withoutPremium } = sent;
    expect(
      describeFeeMismatch(withoutPremium, held({ buyersPremium: 99, internetSurchargeRate: null })),
    ).toBeNull();
  });
});
