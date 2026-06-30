import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { ISettlementCompliancePolicy } from "../aml/settlement-compliance.policy.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IPaymentWriteRepository } from "../interfaces/payment-write.js";
import type { IStripePaymentGateway } from "../stripe/stripe-payment-gateway.js";
import {
  type CheckoutOrchestratorDeps,
  promotePendingToComplianceManualReview,
  resolvePendingCheckoutManualReviewReason,
  revokeOpenStripeCheckoutForPayment,
} from "./checkout-orchestrator.js";
import { PaymentTierPolicy, parsePaymentTierLimits } from "./payment-tier.policy.js";

const policy = new PaymentTierPolicy(
  parsePaymentTierLimits({
    STRIPE_CARD_CHECKOUT_MAX: 100_000,
    STRIPE_MANUAL_REVIEW_MIN: 500_000,
    STRIPE_ABSOLUTE_MAX: 999_999.99,
  }),
);

const baseLot = (): Lot =>
  ({
    id: "lot-1",
    buyerLegalEntityId: "le-buyer",
    sellerLegalEntityId: "le-seller",
  }) as Lot;

function baseDeps(overrides: Partial<CheckoutOrchestratorDeps> = {}): CheckoutOrchestratorDeps {
  return {
    payments: {
      findById: vi.fn().mockResolvedValue({ id: "pay-1", stripePaymentIntentId: "pi_1" }),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as IPaymentWriteRepository,
    users: {} as never,
    accounting: {} as never,
    stripeCheckout: null,
    stripePayments: {
      isConfigured: () => true,
      revokeOpenCheckoutForPayment: vi.fn().mockResolvedValue(undefined),
    } as unknown as IStripePaymentGateway,
    settlementCompliance: null,
    paymentTierPolicy: policy,
    legalEntityRepository: undefined,
    db: {} as never,
    domainEventPublisher: {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainEventPublisher,
    xeroInvoiceBlocking: true,
    ...overrides,
  };
}

describe("revokeOpenStripeCheckoutForPayment", () => {
  it("revokes open checkout when Stripe is configured", async () => {
    const revoke = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      stripePayments: {
        isConfigured: () => true,
        revokeOpenCheckoutForPayment: revoke,
      } as unknown as IStripePaymentGateway,
    });
    await revokeOpenStripeCheckoutForPayment(deps, "pay-1");
    expect(revoke).toHaveBeenCalledWith("pay-1", "pi_1");
  });

  it("no-ops when Stripe is not configured", async () => {
    const deps = baseDeps({
      stripePayments: { isConfigured: () => false } as unknown as IStripePaymentGateway,
    });
    await revokeOpenStripeCheckoutForPayment(deps, "pay-1");
    expect(deps.payments.findById).not.toHaveBeenCalled();
  });
});

describe("resolvePendingCheckoutManualReviewReason", () => {
  it("returns compliance reason when hold is active", async () => {
    const settlementCompliance: ISettlementCompliancePolicy = {
      evaluate: vi.fn().mockResolvedValue({ hold: true, reason: "aml_hold" }),
      peek: vi.fn(),
    };
    const reason = await resolvePendingCheckoutManualReviewReason(
      baseDeps({ settlementCompliance }),
      "pay-1",
      baseLot(),
      "buyer-1",
      "100.00",
    );
    expect(reason).toBe("aml_hold");
  });

  it("returns tier reason when seller is archived", async () => {
    const deps = baseDeps({
      legalEntityRepository: {
        findById: vi.fn().mockResolvedValue({ id: "le-seller", status: "archived" }),
      } as never,
    });
    const reason = await resolvePendingCheckoutManualReviewReason(
      deps,
      "pay-1",
      baseLot(),
      "buyer-1",
      "600000.00",
    );
    expect(reason).toBe("seller_archived_and_high_value");
  });
});

describe("promotePendingToComplianceManualReview", () => {
  it("updates status, publishes event, and returns manual review payload", async () => {
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const publish = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      payments: {
        findById: vi.fn().mockResolvedValue({ id: "pay-1", stripePaymentIntentId: "pi_1" }),
        updateStatus,
      } as unknown as IPaymentWriteRepository,
      domainEventPublisher: { publish } as unknown as DomainEventPublisher,
    });

    const result = await promotePendingToComplianceManualReview(
      deps,
      "pay-1",
      baseLot(),
      "buyer-1",
      "100.00",
      "aml_hold",
    );

    expect(updateStatus).toHaveBeenCalledWith("pay-1", "requires_manual_review");
    expect(publish).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({
        eventType: "payment.requires_manual_review",
        payload: expect.objectContaining({
          paymentId: "pay-1",
          reason: "aml_hold",
          currency: "GBP",
        }),
      }),
    );
    expect(result).toEqual({
      checkoutUrl: null,
      checkoutRail: null,
      manualReviewReason: "aml_hold",
    });
  });
});
