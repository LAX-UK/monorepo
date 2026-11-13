import type { StaffOldRuleSale } from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import { oldRuleReviewRow } from "./old-rule-review.js";

const row: StaffOldRuleSale = {
  lineId: "line-1",
  payoutId: "payout-1",
  payoutCreatedAt: new Date("2026-09-30T09:00:00Z"),
  paidAt: new Date("2026-10-01T09:00:00Z"),
  legalEntityId: "seller-1",
  sellerName: "Northbank Gallery Ltd",
  lotId: "lot-1",
  lotNumber: 12,
  lotTitle: "Harbour at Dusk",
  // Hammer £1,000 plus 25% premium; the old 5% fee was taken on the whole payment.
  paymentAmount: "1250.00",
  platformFee: "62.50",
  hammerPence: 100_000,
  agreement: {
    reference: "C-1042",
    submissionId: "sub-1",
    signedAt: new Date("2026-08-01T10:00:00Z"),
    source: "online",
    commissionPercent: "12.00",
  },
};

describe("oldRuleReviewRow", () => {
  it("sets what the seller was paid beside what the agreement gives, by the calculator", () => {
    // Paid £1,187.50. The agreement gives £1,000 less 12% (£120) and VAT on it (£24): £856.
    expect(oldRuleReviewRow(row, "standard")).toMatchObject({
      paidNetPence: 118_750,
      agreementGives: {
        kind: "priced",
        commissionBps: 1200,
        commissionPence: 12_000,
        commissionVatPence: 2_400,
        netPence: 85_600,
      },
      differencePence: 85_600 - 118_750,
    });
  });

  it("charges no VAT when the company is not VAT-registered", () => {
    expect(oldRuleReviewRow(row, "not_registered").agreementGives).toMatchObject({
      commissionVatPence: 0,
      netPence: 88_000,
    });
  });

  it.each([
    ["no_hammer", { hammerPence: null }, "standard"],
    ["no_agreement", { agreement: null }, "standard"],
    [
      "no_commission",
      { agreement: { ...row.agreement, commissionPercent: null } as StaffOldRuleSale["agreement"] },
      "standard",
    ],
    ["vat_setting_missing", {}, null],
  ] as const)("gives no figure when there is %s", (reason, over, vat) => {
    const result = oldRuleReviewRow({ ...row, ...over }, vat);
    expect(result.agreementGives).toEqual({ kind: "unpriced", reason });
    expect(result.differencePence).toBeNull();
    expect(result.paidNetPence).toBe(118_750);
  });
});
