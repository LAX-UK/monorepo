import { describe, expect, it, vi } from "vitest";
import type { ISettlementCompliancePolicy } from "../aml/settlement-compliance.policy.js";
import { PaymentTierPolicy, parsePaymentTierLimits } from "./payment-tier.policy.js";
import { resolveManualReviewReason } from "./resolve-manual-review-reason.js";

const policy = new PaymentTierPolicy(
  parsePaymentTierLimits({
    STRIPE_CARD_CHECKOUT_MAX: 100_000,
    STRIPE_MANUAL_REVIEW_MIN: 500_000,
    STRIPE_ABSOLUTE_MAX: 999_999.99,
  }),
);

describe("resolveManualReviewReason", () => {
  it("prefers AML hold over tier reason", async () => {
    const settlementCompliance: ISettlementCompliancePolicy = {
      evaluate: vi.fn().mockResolvedValue({ hold: true, reason: "aml_hold" }),
      peek: vi.fn().mockResolvedValue({ hold: true, reason: "aml_hold" }),
    };
    const result = await resolveManualReviewReason({
      buyerUserId: "buyer-1",
      amountPence: 60_000_000,
      sellerArchived: false,
      paymentTierPolicy: policy,
      settlementCompliance,
      paymentStatus: "requires_manual_review",
    });
    expect(result).toEqual({ manualReviewReason: "aml_hold", complianceHold: true });
  });

  it("returns tier reason when compliance is clear", async () => {
    const settlementCompliance: ISettlementCompliancePolicy = {
      evaluate: vi.fn().mockResolvedValue({ hold: false, reason: null }),
      peek: vi.fn().mockResolvedValue({ hold: false, reason: null }),
    };
    const result = await resolveManualReviewReason({
      buyerUserId: "buyer-1",
      amountPence: 60_000_000,
      sellerArchived: false,
      paymentTierPolicy: policy,
      settlementCompliance,
      paymentStatus: "requires_manual_review",
    });
    expect(result.manualReviewReason).toBe("high_value");
    expect(result.complianceHold).toBe(false);
  });

  it("returns finance_release_required when manual review queue has no tier reason", async () => {
    const settlementCompliance: ISettlementCompliancePolicy = {
      evaluate: vi.fn().mockResolvedValue({ hold: false, reason: null }),
      peek: vi.fn().mockResolvedValue({ hold: false, reason: null }),
    };
    const result = await resolveManualReviewReason({
      buyerUserId: "buyer-1",
      amountPence: 8_375_000,
      sellerArchived: false,
      paymentTierPolicy: policy,
      settlementCompliance,
      paymentStatus: "requires_manual_review",
    });
    expect(result).toEqual({
      manualReviewReason: "finance_release_required",
      complianceHold: false,
    });
  });

  it("returns compliance reason for pending payments when hold is active", async () => {
    const settlementCompliance: ISettlementCompliancePolicy = {
      evaluate: vi.fn().mockResolvedValue({ hold: true, reason: "source_of_funds_required" }),
      peek: vi.fn().mockResolvedValue({ hold: true, reason: "source_of_funds_required" }),
    };
    const result = await resolveManualReviewReason({
      buyerUserId: "buyer-1",
      amountPence: 10_000,
      sellerArchived: false,
      paymentTierPolicy: policy,
      settlementCompliance,
      paymentStatus: "pending",
    });
    expect(result).toEqual({
      manualReviewReason: "source_of_funds_required",
      complianceHold: true,
    });
  });
});
