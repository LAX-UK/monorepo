import { describe, expect, it } from "vitest";
import {
  FEE_MISMATCH_PREFIX,
  describeFeeMismatch,
  feeMismatchSegment,
  joinMessages,
  withFeeMismatch,
  withoutFeeMismatch,
} from "./atg-fee-check.js";
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
      `${FEE_MISMATCH_PREFIX}Buyer's premium VAT: LAX sent 20% (0.2), ATG has 2000% (20); Internet surcharge VAT: LAX sent 20% (0.2), ATG has 2000% (20).`,
    );
  });

  it("skips fields ATG did not return or LAX did not send", () => {
    const { BuyersPremium: _omitted, ...withoutPremium } = sent;
    expect(
      describeFeeMismatch(withoutPremium, held({ buyersPremium: 99, internetSurchargeRate: null })),
    ).toBeNull();
  });
});

describe("fee mismatch inside lastError", () => {
  const mismatch = `${FEE_MISMATCH_PREFIX}Buyer's premium: LAX sent 25%, ATG has 0.25%.`;

  it("shows percent rates plainly", () => {
    expect(describeFeeMismatch(sent, held({ buyersPremium: 0.25 }))).toBe(mismatch);
  });

  it("finds the message at the start, with or without other text after it", () => {
    expect(feeMismatchSegment(mismatch)).toBe(mismatch);
    expect(feeMismatchSegment(`${mismatch} Lot 2: needs a lot number`)).toBe(mismatch);
    expect(feeMismatchSegment("Poll failed: down")).toBeNull();
    expect(feeMismatchSegment(null)).toBeNull();
  });

  it("splits the other text off, and keeps the message through another write", () => {
    const stored = joinMessages(mismatch, "Poll failed: down");
    expect(withoutFeeMismatch(stored)).toBe("Poll failed: down");
    expect(withoutFeeMismatch(mismatch)).toBeNull();
    expect(withFeeMismatch(stored, "Not published: fix these lots first.")).toBe(
      `${mismatch} Not published: fix these lots first.`,
    );
    expect(withFeeMismatch(mismatch, null)).toBe(mismatch);
    expect(withFeeMismatch("Poll failed: down", null)).toBeNull();
  });
});
