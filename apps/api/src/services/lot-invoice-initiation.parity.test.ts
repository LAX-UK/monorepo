import { LotInvoiceInitiationService as SharedLotInvoiceInitiationService } from "@auction/finance-runtime";
import type {
  ILegalEntityRepository,
  ILotFulfilmentPaymentHook,
  ILotRepository,
  IPaymentWriteRepository,
  ISaleRepository,
  IUserRepository,
} from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { ISettlementCompliancePolicy } from "./aml/settlement-compliance.policy.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { IInvoiceAccountingProvider } from "./interfaces/invoice-accounting.js";
import type { INotificationOutboxService } from "./interfaces/notification-outbox.js";
import { LotInvoiceInitiationService as ApiLotInvoiceInitiationService } from "./lot-invoice-initiation.service.js";
import { NotificationFactory } from "./notification.factory.js";
import { PaymentTierPolicy, parsePaymentTierLimits } from "./payment/payment-tier.policy.js";

/**
 * "Raise the invoice when a lot is sold" used to exist twice: an API copy (backfill cron) and a
 * finance-runtime copy (worker, at lot end). Each case below is one place where they differed,
 * now settled on one behaviour in the one shared implementation.
 */

const tierPolicy = new PaymentTierPolicy(
  parsePaymentTierLimits({
    STRIPE_CARD_CHECKOUT_MAX: 10_000,
    STRIPE_MANUAL_REVIEW_MIN: 500_000,
    STRIPE_ABSOLUTE_MAX: 999_999.99,
  }),
);

const LOT_ID = "00000000-0000-4000-8000-000000000001";
const baseLot = {
  id: LOT_ID,
  title: "Blue Vase",
  status: "ended",
  winnerId: "buyer-1",
  buyerLegalEntityId: "00000000-0000-4000-8000-000000000010",
  sellerLegalEntityId: "00000000-0000-4000-8000-000000000020",
  saleId: null,
  currentPrice: "1000.00",
  buyerPremiumRate: "0.25",
} as unknown as Lot;

function build(scenario: { hold?: boolean; xero?: { ok: boolean; error?: string } } = {}) {
  const create = vi.fn(async (input: { amount: string; status: string }) => ({
    id: "pay-new",
    lotId: LOT_ID,
    amount: input.amount,
    status: input.status,
    createdAt: new Date("2026-06-26T12:00:00.000Z"),
  }));
  const stageDispatch = vi.fn().mockResolvedValue(undefined);
  const publish = vi.fn().mockResolvedValue(undefined);
  const ensureInvoiceForPayment = vi.fn().mockResolvedValue(scenario.xero ?? { ok: true });
  const ensureAwaitingPayment = vi.fn().mockResolvedValue(undefined);
  const record = vi.fn();
  const service = new ApiLotInvoiceInitiationService(
    { findById: vi.fn().mockResolvedValue(baseLot) } as unknown as ILotRepository,
    { findById: vi.fn().mockResolvedValue(null) } as unknown as ISaleRepository,
    {
      findOpenByLotAndBuyerAccount: vi.fn().mockResolvedValue(null),
      findRefundedByLotAndBuyerAccount: vi.fn().mockResolvedValue(null),
      create,
    } as unknown as IPaymentWriteRepository,
    {
      evaluate: vi
        .fn()
        .mockResolvedValue(
          scenario.hold ? { hold: true, reason: "aml_hold" } : { hold: false, reason: null },
        ),
      peek: vi.fn(),
    } as unknown as ISettlementCompliancePolicy,
    tierPolicy,
    {
      computePlatformFee: vi.fn(),
      computePlatformFeeFromPence: vi.fn().mockResolvedValue("62.50"),
    },
    {
      isConfigured: vi.fn().mockReturnValue(true),
      ensureInvoiceForPayment,
    } as unknown as IInvoiceAccountingProvider,
    { stageDispatch } as unknown as INotificationOutboxService,
    new NotificationFactory(),
    { publish, withTx: vi.fn().mockReturnValue({ publish }) } as IDomainEventSink,
    { ensureAwaitingPayment, onPaymentCaptured: vi.fn() } as ILotFulfilmentPaymentHook,
    {
      findById: vi.fn().mockResolvedValue({ status: "active" }),
    } as unknown as ILegalEntityRepository,
    {
      findById: vi.fn().mockResolvedValue({ id: "buyer-1", email: "b@example.com", name: "B" }),
    } as unknown as IUserRepository,
    { forInvoice: async ({ winnerUserId }) => [winnerUserId, "finance-1"] },
    { record },
  );
  return { service, create, stageDispatch, ensureInvoiceForPayment, ensureAwaitingPayment, record };
}

describe("lot invoice initiation: one implementation for the API and the worker", () => {
  it("the API module is the shared finance-runtime class, not a copy", () => {
    expect(ApiLotInvoiceInitiationService).toBe(SharedLotInvoiceInitiationService);
  });

  it("kept from the API copy: a buyer on an AML hold is held, with no payment-due notice", async () => {
    const { service, create, stageDispatch, record } = build({ hold: true });
    await service.ensureForLot(LOT_ID);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "requires_manual_review" }),
    );
    expect(stageDispatch).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith("settlement_compliance_hold_aml_hold");
  });

  it("kept from the API copy: the invoice opens its fulfilment record as awaiting payment", async () => {
    const { service, ensureAwaitingPayment } = build();
    await service.ensureForLot(LOT_ID);
    expect(ensureAwaitingPayment).toHaveBeenCalledWith(LOT_ID, "pay-new", null);
  });

  it("kept from the API copy: the notice carries the invoice number and lot title", async () => {
    const { service, stageDispatch } = build();
    await service.ensureForLot(LOT_ID);
    expect(stageDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "payment_due:pay-new",
        payload: expect.objectContaining({
          meta: expect.objectContaining({ invoiceNumber: "PAY-PAY-NEW", lotTitle: "Blue Vase" }),
        }),
      }),
    );
  });

  it("changed: Xero writes switched off no longer stop the invoice; the Xero step defers", async () => {
    const { service, create, stageDispatch, record } = build({
      xero: { ok: false, error: "xero_api_writes_disabled" },
    });
    const result = await service.ensureForLot(LOT_ID);
    expect(result).toEqual({ created: true, paymentId: "pay-new", lotId: LOT_ID });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "1250.00", platformFee: "62.50", status: "pending" }),
    );
    expect(stageDispatch).toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith("xero_invoice_deferred");
  });

  it("tells the winner and the account's payers, each once, with their own notice key", async () => {
    const { service, stageDispatch } = build();
    await service.ensureForLot(LOT_ID);
    expect(stageDispatch.mock.calls.map(([call]) => [call.userId, call.idempotencyKey])).toEqual([
      ["buyer-1", "payment_due:pay-new"],
      ["finance-1", "payment_due:pay-new:finance-1"],
    ]);
  });

  it("kept from the worker copy: results name the lot", async () => {
    const { service } = build();
    await expect(service.ensureForLot(LOT_ID)).resolves.toMatchObject({ lotId: LOT_ID });
  });
});
