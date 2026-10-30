import { describe, expect, it } from "vitest";
import { consignmentReference, saleLineBreakdown, soldLotPayoutStage } from "./selling-records.js";

describe("consignmentReference", () => {
  it("prefixes the number", () => {
    expect(consignmentReference(1042)).toBe("C-1042");
  });
});

describe("soldLotPayoutStage", () => {
  it("follows the buyer's payment until the sale is on a payout", () => {
    expect(soldLotPayoutStage({ paymentStatus: null, payoutStatus: null })).toBe("buyer_paying");
    expect(soldLotPayoutStage({ paymentStatus: "pending", payoutStatus: null })).toBe(
      "buyer_paying",
    );
    expect(soldLotPayoutStage({ paymentStatus: "captured", payoutStatus: null })).toBe(
      "paid_by_buyer",
    );
  });

  it.each([
    ["scheduled", "in_payout"],
    ["in_transit", "in_payout"],
    ["paid", "paid_out"],
    ["failed", "payout_problem"],
    ["reversed", "payout_problem"],
    ["clawback_pending", "payout_problem"],
  ] as const)("reads a %s payout as %s", (payoutStatus, stage) => {
    expect(soldLotPayoutStage({ paymentStatus: "captured", payoutStatus })).toBe(stage);
  });

  it("says refunded whatever the payout says", () => {
    expect(soldLotPayoutStage({ paymentStatus: "refunded", payoutStatus: "paid" })).toBe(
      "refunded",
    );
  });
});

describe("saleLineBreakdown", () => {
  it("takes the whole fee when the whole payment settles", () => {
    expect(
      saleLineBreakdown({ lineAmount: "1250.00", paymentAmount: "1250.00", platformFee: "250.00" }),
    ).toEqual({ gross: "1250.00", commissionAndFees: "250.00", net: "1000.00" });
  });

  it("takes the fee in proportion, rounded to the penny, when part settles", () => {
    expect(
      saleLineBreakdown({ lineAmount: "100.00", paymentAmount: "300.00", platformFee: "10.00" }),
    ).toEqual({ gross: "100.00", commissionAndFees: "3.33", net: "96.67" });
  });
});
