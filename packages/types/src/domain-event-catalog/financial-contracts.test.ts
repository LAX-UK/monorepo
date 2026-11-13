import { describe, expect, it } from "vitest";
import {
  DomainEventContractError,
  guardDomainEventPublish,
  parseDomainEventPayload,
  paymentCapturedPayloadSchemaV1,
  paymentRefundedPayloadSchemaV1,
  payoutPaidPayloadSchemaV1,
  payoutSettlementCreatedPayloadSchemaV1,
} from "./index.js";

describe("financial domain event contracts", () => {
  it("parses payment.captured producer fixture", () => {
    const payload = {
      paymentId: "11111111-1111-4111-8111-111111111111",
      lotId: "22222222-2222-4222-8222-222222222222",
      userId: "user_1",
      amountCents: 12_500,
      capturedAt: "2026-07-21T12:00:00.000Z",
      stripeIntentId: "pi_123",
      stripeChargeId: "ch_123",
      via: "stripe_checkout_webhook" as const,
      buyerName: "Buyer",
      buyerEmail: "buyer@example.com",
    };
    expect(parseDomainEventPayload("payment.captured", 1, payload)).toEqual({
      ok: true,
      data: paymentCapturedPayloadSchemaV1.parse(payload),
    });
  });

  it("parses payment.refunded admin and webhook fixtures", () => {
    const admin = {
      amount: "100.00",
      currency: "GBP" as const,
      sellerLegalEntityId: "33333333-3333-4333-8333-333333333333",
      via: "admin_manual" as const,
      stripeRefundId: "re_1",
    };
    expect(parseDomainEventPayload("payment.refunded", 1, admin).ok).toBe(true);

    const webhook = {
      stripeChargeId: "ch_1",
      amountCents: 5000,
      cumulativeRefundedCents: 5000,
      currency: "gbp",
      sellerLegalEntityId: "33333333-3333-4333-8333-333333333333",
      via: "stripe_webhook" as const,
    };
    expect(parseDomainEventPayload("payment.refunded", 1, webhook).ok).toBe(true);
    paymentRefundedPayloadSchemaV1.parse(webhook);
  });

  it("parses payout fixtures consumed by Xero", () => {
    const paid = {
      legalEntityId: "44444444-4444-4444-8444-444444444444",
      status: "paid" as const,
      stripeTransferId: "tr_1",
      grossAmount: "1000.00",
      platformFee: "100.00",
      stripeFee: "10.00",
      netAmount: "890.00",
      currency: "GBP",
      processedAt: "2026-07-21T12:00:00.000Z",
      via: "mark_paid",
    };
    payoutPaidPayloadSchemaV1.parse(paid);
    expect(parseDomainEventPayload("payout.paid", 1, paid).ok).toBe(true);

    const settlement = {
      legalEntityId: "44444444-4444-4444-8444-444444444444",
      grossAmount: "1000.00",
      platformFee: "100.00",
      stripeFee: "10.00",
      netAmount: "890.00",
      currency: "GBP",
      paymentLineCount: 3,
      periodStart: "2026-01-01T00:00:00.000Z",
      periodEnd: "2026-07-21T12:00:00.000Z",
      source: "bulk_cron" as const,
    };
    payoutSettlementCreatedPayloadSchemaV1.parse(settlement);
    expect(parseDomainEventPayload("payout.settlement_created", 1, settlement).ok).toBe(true);
  });

  it("carries each sale's split from its seller terms, so the accounts never work it out again", () => {
    const sale = {
      paymentId: "55555555-5555-4555-8555-555555555555",
      lotId: "66666666-6666-4666-8666-666666666666",
      sellerTermsId: "77777777-7777-4777-8777-777777777777",
      agreementId: "88888888-8888-4888-8888-888888888888",
      hammerPence: 8_200_000,
      commissionBps: 1500,
      commissionPence: 1_230_000,
      commissionVatTreatment: "standard",
      commissionVatBps: 2000,
      commissionVatPence: 246_000,
      sellerNetPence: 6_724_000,
    };
    const settlement = {
      legalEntityId: "44444444-4444-4444-8444-444444444444",
      grossAmount: "82000.00",
      platformFee: "14760.00",
      stripeFee: "0.00",
      netAmount: "67240.00",
      currency: "GBP",
      paymentLineCount: 1,
      periodStart: "2026-11-01T00:00:00.000Z",
      periodEnd: "2026-11-13T12:00:00.000Z",
      source: "admin" as const,
      hammerAmount: "82000.00",
      commissionAmount: "12300.00",
      commissionVatAmount: "2460.00",
      sales: [sale],
      heldSales: [
        {
          paymentId: "99999999-9999-4999-8999-999999999999",
          lotId: null,
          reason: "no_agreement",
        },
      ],
    };
    expect(parseDomainEventPayload("payout.settlement_created", 1, settlement).ok).toBe(true);
    expect(
      parseDomainEventPayload("payout.settlement_created", 1, {
        ...settlement,
        sales: [{ ...sale, sellerNetPence: -1 }],
      }).ok,
    ).toBe(false);
    expect(
      parseDomainEventPayload("payout.settlement_created", 1, {
        ...settlement,
        heldSales: [{ paymentId: sale.paymentId, lotId: null, reason: "guessed" }],
      }).ok,
    ).toBe(false);
  });
});

describe("guardDomainEventPublish", () => {
  it("throws in enforce mode for invalid payloads", () => {
    expect(() =>
      guardDomainEventPublish("enforce", {
        eventType: "payment.captured",
        payload: { bad: true },
      }),
    ).toThrow(DomainEventContractError);
  });

  it("does not throw in observe mode", () => {
    const observed: string[] = [];
    expect(() =>
      guardDomainEventPublish(
        "observe",
        { eventType: "payment.captured", payload: { bad: true } },
        (d) => observed.push(d.error),
      ),
    ).not.toThrow();
    expect(observed.length).toBe(1);
  });
});
