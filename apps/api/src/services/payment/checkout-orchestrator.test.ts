import type { IPaymentDomainEventsRepository } from "@auction/persistence/interfaces";
import type { IPaymentWriteRepository } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { ISettlementCompliancePolicy } from "../aml/settlement-compliance.policy.js";
import type { IStripePaymentGateway } from "../stripe/stripe-payment-gateway.js";
import {
  type CheckoutOrchestratorDeps,
  issueCheckoutForPendingPayment,
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
    invoices: { findByPaymentIds: vi.fn().mockResolvedValue(new Map()) },
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
    paymentEvents: {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as IPaymentDomainEventsRepository,
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

  it("logs and reports a failed revoke instead of hiding it", async () => {
    const report = vi.fn();
    const failure = new Error("intent is processing");
    const deps = baseDeps({
      stripePayments: {
        isConfigured: () => true,
        revokeOpenCheckoutForPayment: vi.fn().mockRejectedValue(failure),
      } as unknown as IStripePaymentGateway,
      errorReporter: { report },
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await revokeOpenStripeCheckoutForPayment(deps, "pay-1");
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ code: "stripe_checkout_revoke_failed", cause: failure }),
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("stripe_checkout_revoke_failed"));
    log.mockRestore();
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

  it("checks the lot's winner as well as an organisation payer paying for them", async () => {
    const evaluate = vi.fn(async (input: { buyerUserId: string }) =>
      input.buyerUserId === "agent-1"
        ? { hold: true, reason: "aml_hold" as const }
        : { hold: false, reason: null },
    );
    const reason = await resolvePendingCheckoutManualReviewReason(
      baseDeps({ settlementCompliance: { evaluate, peek: vi.fn() } }),
      "pay-1",
      { ...baseLot(), winnerId: "agent-1" },
      "finance-1",
      "100.00",
    );
    expect(reason).toBe("aml_hold");
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ buyerUserId: "finance-1", excludePaymentId: "pay-1" }),
    );
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ buyerUserId: "agent-1", amountPence: 10_000 }),
    );
  });

  it("a winner paying their own lot is checked once", async () => {
    const evaluate = vi.fn(async () => ({ hold: false, reason: null }));
    await resolvePendingCheckoutManualReviewReason(
      baseDeps({ settlementCompliance: { evaluate, peek: vi.fn() } }),
      "pay-1",
      { ...baseLot(), winnerId: "buyer-1" },
      "buyer-1",
      "100.00",
    );
    expect(evaluate).toHaveBeenCalledTimes(1);
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
      paymentEvents: { publish } as unknown as IPaymentDomainEventsRepository,
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

describe("issueCheckoutForPendingPayment charges from the stored invoice", () => {
  const invoice = (totalPence: number, linePence = totalPence) => ({
    id: "inv-1",
    lotId: "lot-1",
    buyerLegalEntityId: "le-buyer",
    sellerLegalEntityId: "le-seller",
    totalPence,
    raisedAt: new Date("2026-11-01T10:00:00Z"),
    dueAt: new Date("2026-11-08T23:59:59Z"),
    pricingPolicyId: null,
    number: null,
    source: "raised" as const,
    voidedAt: null,
    lines: [
      { kind: "legacy_total" as const, label: "Total", ratePercent: null, amountPence: linePence },
    ],
  });

  function checkoutDeps(stored: Map<string, ReturnType<typeof invoice>>) {
    const createCheckout = vi
      .fn()
      .mockResolvedValue({ checkoutUrl: "https://pay", checkoutRail: "card" });
    const deps = baseDeps({
      invoices: { findByPaymentIds: vi.fn().mockResolvedValue(stored) },
      users: {
        findById: vi.fn().mockResolvedValue({ email: "b@example.com", name: "B" }),
      } as never,
      accounting: { isConfigured: () => false } as never,
      stripeCheckout: { isAvailable: () => true, createCheckout },
    });
    return { deps, createCheckout };
  }

  const run = (deps: CheckoutOrchestratorDeps) =>
    issueCheckoutForPendingPayment(deps, "pay-1", baseLot(), "buyer-1", "125.00", new Date());

  it("passes the stored lines to the rail", async () => {
    const { deps, createCheckout } = checkoutDeps(new Map([["pay-1", invoice(12_500)]]));
    expect((await run(deps)).isOk()).toBe(true);
    expect(createCheckout).toHaveBeenCalledWith(
      "card",
      expect.objectContaining({ invoiceLines: invoice(12_500).lines, amountPence: 12_500 }),
    );
  });

  it("opens no checkout when the payment has no stored invoice", async () => {
    const { deps, createCheckout } = checkoutDeps(new Map());
    const result = await run(deps);
    expect(result._unsafeUnwrapErr().stripeCode).toBe("invoice_unavailable");
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("opens no checkout when the invoice total is not the payment amount", async () => {
    const { deps, createCheckout } = checkoutDeps(new Map([["pay-1", invoice(12_499)]]));
    expect((await run(deps)).isErr()).toBe(true);
    expect(createCheckout).not.toHaveBeenCalled();
  });
});
